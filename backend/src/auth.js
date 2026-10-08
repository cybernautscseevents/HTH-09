import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId } from "mongodb";
import { getDatabase } from "./database.js";

const scrypt = promisify(scryptCallback);
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const secret = () => process.env.AUTH_SECRET;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createToken(userId) {
  if (!secret() || secret().length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || !secret()) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.sub && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch { return null; }
}

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const claims = readToken(token);
  if (!claims || !ObjectId.isValid(claims.sub)) return res.status(401).json({ message: "Please sign in to continue." });
  try {
    const user = await getDatabase().collection("users").findOne({ _id: new ObjectId(claims.sub) }, { projection: { name: 1, email: 1 } });
    if (!user) return res.status(401).json({ message: "This account is no longer available." });
    req.user = { id: user._id.toHexString(), name: user.name, email: user.email };
    next();
  } catch (error) { next(error); }
}
