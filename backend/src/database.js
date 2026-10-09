import { MongoClient } from "mongodb";

let client;
let database;
let connectionPromise;

export async function connectDatabase() {
  if (database) return true;
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) return false;

  connectionPromise = (async () => {
    const nextClient = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    try {
      await nextClient.connect();
      const nextDatabase = nextClient.db(process.env.MONGODB_DB || undefined);
      await nextDatabase.collection("users").createIndex({ email: 1 }, { unique: true });
      await nextDatabase.collection("patientData").createIndex({ userId: 1 }, { unique: true });
      client = nextClient;
      database = nextDatabase;
      return true;
    } catch (error) {
      await nextClient.close().catch(() => {});
      throw error;
    }
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

export function getDatabase() {
  if (!database) throw new Error("Database is not connected. Configure MONGODB_URI in backend/.env.");
  return database;
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
  connectionPromise = undefined;
}
