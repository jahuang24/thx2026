import express from "express";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";
import pdfParse from "pdf-parse";
import crypto from "crypto";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Readable } from "stream";

const router = express.Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY, 
});

const chunkText = (text, size = 1200) => {
  if (!text) return [];
  const chunks = [];
  let cursor = 0;
  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + size));
    cursor += size;
  }
  return chunks;
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const hashText = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

async function embedText(text) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding failed: ${detail}`);
  }
  const data = await response.json();
  return data.data?.[0]?.embedding ?? [];
}

async function chatResponse(system, user) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat failed: ${detail}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

router.post("/speak", async (req, res) => {
  try {
    // Extract voiceId from body
    const { text, voiceId } = req.body; 
    console.log("connected to baymax");
    // Fallback to a default if the frontend doesn't send one
    const targetVoice = voiceId || process.env.ELEVENLABS_VOICE_ID || "wJ5MX7uuKXZwFqGdWM4N";
    console.log(targetVoice);
    const audioStream = await elevenlabs.textToSpeech.convert(targetVoice, {
      text: text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    });

    res.set({
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
    });

    Readable.fromWeb(audioStream).pipe(res);

  } catch (err) {
    console.error("ElevenLabs Error:", err);
    res.status(500).send("Speech synthesis failed");
  }
});

// Login or first-time registration
router.post("/login", async (req, res) => {
  try {
    const { name, mrn, dob, medicalRecord } = req.body || {};
    if (!name || !mrn) {
      res.status(400).send("name and mrn are required");
      return;
    }

    const db = getDb();
    const collection = db.collection("Patients");

    const existing = await collection.findOne({ mrn: String(mrn) });
    if (existing) {
      res.status(200).send(existing);
      return;
    }

    if (!medicalRecord) {
      res.status(409).send({ code: "RECORDS_REQUIRED", message: "Medical record required for first-time sign-in." });
      return;
    }

    const newPatient = {
      name: String(name),
      mrn: String(mrn),
      dob: dob ? String(dob) : null,
      medicalRecord,
      createdAt: new Date().toISOString()
    };

    const result = await collection.insertOne(newPatient);
    try {
      const messages = db.collection("Messages");
      await messages.insertOne({
        patientId: String(result.insertedId),
        sender: "PATIENT",
        body: `New patient profile created for ${newPatient.name}.`,
        sentAt: new Date().toISOString(),
        readByNurse: false,
        readByPatient: true
      });
      const admissions = db.collection("Admissions");
      await admissions.insertOne({
        patientId: String(result.insertedId),
        requestedType: "MED_SURG",
        requestedUnit: "MED-SURG",
        admitStatus: "PENDING",
        requestedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to create welcome message:", err);
    }
    res.status(201).send({ _id: result.insertedId, ...newPatient });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing in patient");
  }
});

// Get patient by id
router.get("/:id", async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection("Patients");

    // Exclude heavy medicalRecord/docs from the common detail fetch; they have a dedicated route.
    const projection = { medicalRecord: 0 };

    const patient = await collection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection }
    );
    if (!patient) {
      res.status(404).send("Not found");
      return;
    }
    res.status(200).send(patient);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching patient");
  }
});

// Update patient assignment (room/bed)
router.patch("/:id", async (req, res) => {
  try {
    const { roomId, bedId, unitId } = req.body || {};
    const updates = { $set: {} };
    if (typeof roomId === "string" || roomId === null) updates.$set.roomId = roomId ?? null;
    if (typeof bedId === "string" || bedId === null) updates.$set.bedId = bedId ?? null;
    if (typeof unitId === "string" || unitId === null) updates.$set.unitId = unitId ?? null;

    if (!Object.keys(updates.$set).length) {
      res.status(400).send("No valid fields to update");
      return;
    }

    const db = getDb();
    const collection = db.collection("Patients");
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      updates
    );
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating patient");
  }
});

// Get medical record for a patient
router.get("/:id/records", async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection("Patients");
    const patient = await collection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { medicalRecord: 1 } }
    );
    if (!patient) {
      res.status(404).send("Not found");
      return;
    }
    res.status(200).send(patient.medicalRecord ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching medical record");
  }
});

// List all patients
router.get("/", async (req, res) => {
  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 8);
  try {
    const db = getDb();
    const collection = db.collection("Patients");

    // Only return fields needed for list views to keep payloads small and fast.
    const projection = { name: 1, mrn: 1, dob: 1, roomId: 1, bedId: 1, createdAt: 1 };

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 200));
    const skip = (page - 1) * limit;

    const results = await collection
      .find({}, { projection })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).send(results);
    const durationMs = Date.now() - startedAt;
    console.log(
      `[patients:list:${requestId}] count=${results.length} page=${page} limit=${limit} durationMs=${durationMs}`
    );
  } catch (err) {
    console.error(err);
    const durationMs = Date.now() - startedAt;
    console.log(`[patients:list:${requestId}] failed durationMs=${durationMs}`);
    res.status(500).send("Error fetching patients");
  }
});

// Get chat history for a patient
router.get("/:id/chat", async (req, res) => {
  try {
    const db = getDb();
    const chats = db.collection("PatientChats");
    const results = await chats
      .find({ patientId: String(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    res.status(200).send(results.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching chat history");
  }
});

// Patient chat with document-aware context
router.post("/:id/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) {
      res.status(400).send("message is required");
      return;
    }

    const db = getDb();
    const patientId = String(req.params.id);
    const patients = db.collection("Patients");
    const messagesCol = db.collection("Messages");
    const embeddingsCol = db.collection("PatientEmbeddings");
    const chats = db.collection("PatientChats");

    const patient = await patients.findOne({ _id: new ObjectId(patientId) });
    if (!patient) {
      res.status(404).send("Patient not found");
      return;
    }

    const urgentPattern = /(chest pain|trouble breathing|can't breathe|severe bleeding|stroke|unconscious|suicid|seizure)/i;
    if (urgentPattern.test(String(message))) {
      const urgentReply =
        "If you have severe or sudden symptoms, please call your nurse immediately or dial emergency services. I can share general information, but I cannot handle emergencies.";
      await chats.insertMany([
        { patientId, role: "user", content: String(message), createdAt: new Date().toISOString() },
        { patientId, role: "assistant", content: urgentReply, createdAt: new Date().toISOString() },
      ]);
      res.status(200).send({ reply: urgentReply });
      return;
    }

    const recentMessages = await messagesCol
      .find({ patientId })
      .sort({ sentAt: -1 })
      .limit(20)
      .toArray();

    const medicalRecord = patient.medicalRecord || {};
    const recordNotes = medicalRecord.notes || "";
    const documents = Array.isArray(medicalRecord.documents) ? medicalRecord.documents : [];

    const documentTexts = [];
    for (const doc of documents) {
      try {
        if (!doc?.data) continue;
        const buffer = Buffer.from(doc.data, "base64");
        const parsed = await pdfParse(buffer);
        if (parsed.text) {
          documentTexts.push({ name: doc.name || "document", text: parsed.text });
        }
      } catch (err) {
        console.error("PDF parse failed:", err);
      }
    }

    const vitalsSummary = patient.vitals ? JSON.stringify(patient.vitals) : "Vitals not available.";
    const messageSummary = recentMessages
      .map((item) => `[${item.sender}] ${item.body}`)
      .join("\\n");

    const sources = [
      { id: "record-notes", text: recordNotes },
      { id: "vitals", text: vitalsSummary },
      { id: "messages", text: messageSummary }
    ];

    documentTexts.forEach((doc, index) => {
      sources.push({ id: `doc-${index}-${doc.name}`, text: doc.text });
    });

    const chunks = sources.flatMap((source) =>
      chunkText(source.text).map((chunk, index) => ({
        id: `${source.id}-${index}`,
        text: chunk,
      }))
    ).filter((chunk) => chunk.text && chunk.text.trim().length > 0);

    const existingEmbeddings = await embeddingsCol
      .find({ patientId, hash: { $in: chunks.map((c) => hashText(c.text)) } })
      .toArray();
    const existingHash = new Set(existingEmbeddings.map((item) => item.hash));

    for (const chunk of chunks) {
      const hash = hashText(chunk.text);
      if (existingHash.has(hash)) continue;
      const embedding = await embedText(chunk.text);
      await embeddingsCol.insertOne({
        patientId,
        hash,
        text: chunk.text,
        embedding,
        createdAt: new Date().toISOString(),
      });
      existingHash.add(hash);
      existingEmbeddings.push({ hash, embedding, text: chunk.text });
    }

    const queryEmbedding = await embedText(String(message));
    const ranked = existingEmbeddings
      .map((item) => ({
        text: item.text,
        score: cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.text);

    const contextBlock = ranked.join("\\n---\\n");

    const systemPrompt = [
      "You are Baymax, a bedside patient assistant.",
      "Use the provided context from the patient's medical record, messages, and vitals.",
      "Offer general medical information, not a diagnosis.",
      "If unsure or if symptoms seem severe, advise contacting the care team.",
      "Keep answers very short (1-3 sentences), clear, and reassuring.",
      "Do not say Baymax in your answer."
    ].join(" ");

    const userPrompt = `Patient question: ${message}\\n\\nContext:\\n${contextBlock}`;

    const reply = await chatResponse(systemPrompt, userPrompt);

    await chats.insertMany([
      { patientId, role: "user", content: String(message), createdAt: new Date().toISOString() },
      { patientId, role: "assistant", content: reply, createdAt: new Date().toISOString() },
    ]);

    res.status(200).send({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating response");
  }
});

// Add indexes to optimize database queries
router.post("/initialize", async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection("Patients");

    // Ensure indexes for faster queries
    await collection.createIndex({ mrn: 1 });
    await collection.createIndex({ _id: 1 });
    await collection.createIndex({ createdAt: -1 });

    res.status(200).send("Indexes created successfully");
  } catch (error) {
    console.error("Error creating indexes:", error);
    res.status(500).send("Failed to create indexes");
  }
});

export default router;
