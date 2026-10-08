import { MongoClient } from "mongodb";

let client;
let database;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  database = client.db(process.env.MONGODB_DB || undefined);
  await database.collection("users").createIndex({ email: 1 }, { unique: true });
  await database.collection("patientData").createIndex({ userId: 1 }, { unique: true });
  return true;
}

export function getDatabase() {
  if (!database) throw new Error("Database is not connected. Configure MONGODB_URI in backend/.env.");
  return database;
}

export async function closeDatabase() {
  if (client) await client.close();
}
