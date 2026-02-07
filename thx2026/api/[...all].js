import { app, ensureDb } from "../server/app.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    await ensureDb();
    return app(req, res);
  } catch (err) {
    console.error("API handler failed:", err);
    res.status(500).send("Server failed to start");
    return null;
  }
}
