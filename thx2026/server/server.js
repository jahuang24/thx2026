import express from "express";
import cors from "cors";
import messages from "./routes/messages.js";
import { connectToDatabase } from "./db/connection.js";

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/messages", messages);

// Connect to database first, then start the server
async function startServer() {
  try {
    await connectToDatabase();
    
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