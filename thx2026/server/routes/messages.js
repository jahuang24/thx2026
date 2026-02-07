import express from "express";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// Retrieve a list of all Messages
router.get("/", async (req, res) => {
  try {
    let db = getDb(); // Get the db instance
    let collection = db.collection("Messages");
    const { patientId, sender } = req.query;
    const query = {};
    if (patientId) query.patientId = String(patientId);
    if (sender) query.sender = String(sender);
    let results = await collection.find(query).sort({ sentAt: -1 }).toArray();
    res.status(200).send(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching messages");
  }
});

// Get a single message by id
router.get("/:id", async (req, res) => {
  try {
    let db = getDb();
    let collection = db.collection("Messages");
    let query = { _id: new ObjectId(req.params.id) };
    let result = await collection.findOne(query);

    if (!result) {
      res.status(404).send("Not found");
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching message");
  }
});

// Create a new message
router.post("/", async (req, res) => {
  try {
    const { patientId, sender, body, sentAt, readByNurse, readByPatient } = req.body;
    if (!patientId || !sender || !body) {
      res.status(400).send("patientId, sender, and body are required");
      return;
    }
    const timestamp = sentAt || new Date().toISOString();
    const isPatient = sender === "PATIENT";
    const isNurse = sender === "NURSE";
    let newDocument = {
      patientId,
      sender,
      body,
      sentAt: timestamp,
      readByNurse: typeof readByNurse === "boolean" ? readByNurse : isNurse,
      readByPatient: typeof readByPatient === "boolean" ? readByPatient : isPatient,
    };
    let db = getDb();
    let collection = db.collection("Messages");
    let result = await collection.insertOne(newDocument);
    res.status(201).send({ _id: result.insertedId, ...newDocument });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding message");
  }
});

// Update a message by id.
router.patch("/:id", async (req, res) => {
  try {
    const query = { _id: new ObjectId(req.params.id) };
    const updates = { $set: {} };
    if (typeof req.body.body === "string") updates.$set.body = req.body.body;
    if (typeof req.body.readByNurse === "boolean")
      updates.$set.readByNurse = req.body.readByNurse;
    if (typeof req.body.readByPatient === "boolean")
      updates.$set.readByPatient = req.body.readByPatient;
    if (typeof req.body.sentAt === "string") updates.$set.sentAt = req.body.sentAt;
    if (!Object.keys(updates.$set).length) {
      res.status(400).send("No valid fields to update");
      return;
    }

    let db = getDb();
    let collection = db.collection("Messages");
    let result = await collection.updateOne(query, updates);
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating message");
  }
});

// Mark thread read for a patient
router.patch("/read/thread", async (req, res) => {
  try {
    const { patientId, reader } = req.body;
    if (!patientId || !reader) {
      res.status(400).send("patientId and reader are required");
      return;
    }

    let db = getDb();
    let collection = db.collection("Messages");

    if (reader === "NURSE") {
      const result = await collection.updateMany(
        { patientId, sender: "PATIENT", readByNurse: { $ne: true } },
        { $set: { readByNurse: true } }
      );
      res.status(200).send(result);
      return;
    }

    if (reader === "PATIENT") {
      const result = await collection.updateMany(
        { patientId, sender: "NURSE", readByPatient: { $ne: true } },
        { $set: { readByPatient: true } }
      );
      res.status(200).send(result);
      return;
    }

    res.status(400).send("reader must be NURSE or PATIENT");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating read status");
  }
});

// Delete a message
router.delete("/:id", async (req, res) => {
  try {
    const query = { _id: new ObjectId(req.params.id) };
    let db = getDb();
    let collection = db.collection("Messages");
    let result = await collection.deleteOne(query);
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting message");
  }
});

export default router;
