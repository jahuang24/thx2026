import { MongoClient, ServerApiVersion, Db } from "mongodb";

const uri = process.env.ATLAS_URI || "";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/** @type {Db | null} */
let db = null;

async function ensureIndexes(database) {
  try {
    await Promise.all([
      database.collection("Patients").createIndex({ createdAt: -1 }),
      database.collection("Messages").createIndex({ sentAt: -1 }),
      database.collection("Messages").createIndex({ patientId: 1, sentAt: -1 }),
      database.collection("Admissions").createIndex({ requestedAt: -1 }),
      database.collection("Admissions").createIndex({ patientId: 1, requestedAt: -1 })
    ]);
  } catch (err) {
    console.error("Index creation failed:", err);
  }
}

async function connectToDatabase() {
  try {
    console.log("Attempting to connect to MongoDB...");
    // Connect the client to the server
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    
    db = client.db("fb407");
    void ensureIndexes(db);
    return db;
  } catch(err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

// Export a function that returns the db instance
function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDatabase first.");
  }
  return db;
}

export { connectToDatabase, getDb };
export default getDb;
