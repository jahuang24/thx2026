import express from "express";
import cors from "cors";
import messages from "./routes/messages.js";
import patients from "./routes/patients.js";
import admissions from "./routes/admissions.js";
import { connectToDatabase } from "./db/connection.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use("/messages", messages);
app.use("/patients", patients);
app.use("/admissions", admissions);

let dbReady = null;

async function ensureDb() {
  if (!dbReady) {
    dbReady = connectToDatabase();
  }
  return dbReady;
}

export { app, ensureDb };
export default app;
