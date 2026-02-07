import express from "express";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";
import pdfParse from "pdf-parse";
import crypto from "crypto";

const router = express.Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

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
    const patient = await collection.findOne({ _id: new ObjectId(req.params.id) });
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

// Get medical record for a patient
router.get("/:id/records", async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection("Patients");
    const patient = await collection.findOne({ _id: new ObjectId(req.params.id) });
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
  try {
    const db = getDb();
    const collection = db.collection("Patients");
    const results = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.status(200).send(results);
  } catch (err) {
    console.error(err);
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
      "Keep answers very short (1-3 sentences), clear, and reassuring."
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

export default router;
