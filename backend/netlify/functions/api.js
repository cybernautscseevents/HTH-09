import serverless from "serverless-http";
import { app, ensureDatabaseConnected } from "../../src/server.js";

const expressHandler = serverless(app);

export async function handler(event, context) {
  try {
    await ensureDatabaseConnected();
  } catch (error) {
    console.error("MongoDB connection failed in Netlify Function.", {
      name: error?.name || "Error",
      code: error?.code || undefined,
    });
  }

  return expressHandler(event, context);
}
