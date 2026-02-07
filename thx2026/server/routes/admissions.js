import express from "express";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = express.Router();

const normalizePatientId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return String(value.$oid);
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
};

// List admissions
router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection("Admissions");
    const results = await collection
      .aggregate([
        { $addFields: { patientIdStr: { $toString: "$patientId" } } },
        { $sort: { requestedAt: -1 } },
        {
          $group: {
            _id: "$patientIdStr",
            doc: { $first: "$$ROOT" }
          }
        },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { requestedAt: -1 } }
      ])
      .toArray();
    const normalized = results.map((doc) => ({
      ...doc,
      patientId: normalizePatientId(doc.patientId)
    }));
    res.status(200).send(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching admissions");
  }
});

// Ensure all patients without assignment are queued
router.post("/queue/ensure", async (req, res) => {
  try {
    const db = getDb();
    const patients = db.collection("Patients");
    const admissions = db.collection("Admissions");

    const patientList = await patients.find({}).toArray();
    const queued = [];
    for (const patient of patientList) {
      const patientId = String(patient._id);
      const existingAdmissions = await admissions
        .find({ patientId: { $in: [patientId, patient._id] } })
        .sort({ requestedAt: -1 })
        .toArray();
      if (existingAdmissions.length) {
        if (existingAdmissions.length > 1) {
          const idsToDelete = existingAdmissions.slice(1).map((item) => item._id);
          if (idsToDelete.length) {
            await admissions.deleteMany({ _id: { $in: idsToDelete } });
          }
        }
        continue;
      }
      const admission = {
        patientId,
        requestedType: "MED_SURG",
        requestedUnit: "MED-SURG",
        admitStatus: "PENDING",
        requestedAt: new Date().toISOString()
      };
      await admissions.insertOne(admission);
      queued.push(admission);
    }

    res.status(200).send({ created: queued.length });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error ensuring admissions queue");
  }
});

// Create admission
router.post("/", async (req, res) => {
  try {
    const { patientId, requestedType, requestedUnit, admitStatus } = req.body || {};
    const normalizedPatientId = normalizePatientId(patientId);
    if (!normalizedPatientId) {
      res.status(400).send("patientId is required");
      return;
    }
    const newAdmission = {
      patientId: normalizedPatientId,
      requestedType: requestedType || "MED_SURG",
      requestedUnit: requestedUnit || "MED-SURG",
      admitStatus: admitStatus || "PENDING",
      requestedAt: new Date().toISOString()
    };
    const db = getDb();
    const collection = db.collection("Admissions");
    const result = await collection.insertOne(newAdmission);
    res.status(201).send({ _id: result.insertedId, ...newAdmission });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating admission");
  }
});

// Update admission status
router.patch("/:id", async (req, res) => {
  try {
    const { admitStatus, assignedAt } = req.body || {};
    const db = getDb();
    const collection = db.collection("Admissions");
    const updates = { $set: {} };
    if (admitStatus) updates.$set.admitStatus = admitStatus;
    if (typeof assignedAt === "string") updates.$set.assignedAt = assignedAt;
    if (!Object.keys(updates.$set).length) {
      res.status(400).send("No valid fields to update");
      return;
    }
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      updates
    );
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating admission");
  }
});

export default router;
