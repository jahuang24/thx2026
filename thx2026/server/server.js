import { app, ensureDb } from "./app.js";

const PORT = process.env.PORT || 5050;

// Connect to database first, then start the server
async function startServer() {
  try {
    await ensureDb();
    // Start the Express server only after DB connection is successful
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
