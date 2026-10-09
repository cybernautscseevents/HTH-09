import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";
import { getDatabase, connectDatabase } from "./database.js";
import { createToken, hashPassword, requireAuth, verifyPassword } from "./auth.js";

// ======================================================
// PATH SETUP
// ======================================================

const __filename = path.resolve(process.argv[1] || "src/server.js");
const __dirname = path.dirname(__filename);

// ======================================================
// SERVER CONFIGURATION
// ======================================================

export const app = express();

const PORT = process.env.PORT || 5000;
let databaseConnected = false;
let databaseInitialization;
const isProduction = process.env.NODE_ENV === "production";
const isNetlifyFunction = Boolean(
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, "mongodb://[redacted]@")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(GEMINI_API_KEY|AUTH_SECRET)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
}

function safeErrorMessage(error, fallback) {
  return isProduction ? fallback : redactSensitiveText(error?.message || fallback);
}

function logServerError(label, error) {
  console.error(label, {
    name: error?.name || "Error",
    code: error?.code || undefined,
    status: error?.status || undefined,
    ...(!isProduction && error?.message ? { message: redactSensitiveText(error.message) } : {}),
  });
}

export async function ensureDatabaseConnected() {
  if (databaseConnected) return true;
  if (!databaseInitialization) {
    databaseInitialization = connectDatabase()
      .then((connected) => {
        databaseConnected = connected;
        return connected;
      })
      .catch((error) => {
        databaseInitialization = null;
        throw error;
      });
  }
  return databaseInitialization;
}

// Gemini model
// Can also be overridden from backend/.env
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// ======================================================
// CORS
// ======================================================

const allowedOrigins = new Set(
  [process.env.CLIENT_URL, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"]
    .flatMap((value) => String(value || "").split(","))
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = String(origin || "").replace(/\/+$/, "");
    if (!origin || allowedOrigins.has(normalizedOrigin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS."));
  },
  credentials: true,
}));

// ======================================================
// BODY PARSING
// ======================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ======================================================
// UPLOAD DIRECTORY
// ======================================================

const uploadDir = isNetlifyFunction
  ? path.join(os.tmpdir(), "carebridge-uploads")
  : path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ======================================================
// MULTER STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname}`
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    cb(null, safeName);
  },
});

// ======================================================
// FILE UPLOAD CONFIG
// ======================================================

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".jpg",
      ".jpeg",
      ".png",
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported file format. Please upload PDF, DOCX or TXT."
        )
      );
    }
  },
});

// ======================================================
// GEMINI INITIALIZATION
// ======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })
  : null;

// ======================================================
// CARE PLAN SCHEMA
// ======================================================

const CARE_PLAN_SCHEMA = {
  type: "object",

  properties: {
    patient_name: {
      type: "string",
      description:
        "Patient name from the discharge summary",
    },

    condition: {
      type: "string",
      description:
        "Main condition or diagnosis explicitly mentioned in the discharge summary",
    },

    summary: {
      type: "string",
      description:
        "Simple patient-friendly summary of the discharge information",
    },

    medicines: {
      type: "array",

      items: {
        type: "object",

        properties: {
          name: {
            type: "string",
          },

          dose: {
            type: "string",
          },

          route: {
            type: "string",
            description:
              "Route of administration only when explicitly stated in the discharge summary; otherwise an empty string",
          },

          frequency: {
            type: "string",
          },

          duration: {
            type: "string",
          },

          instructions: {
            type: "string",
          },
        },

        required: [
          "name",
          "dose",
          "route",
          "frequency",
          "duration",
          "instructions",
        ],
      },
    },

    warning_signs: {
      type: "array",

      items: {
        type: "string",
      },
    },

    follow_up: {
      type: "array",

      items: {
        type: "string",
      },
    },

    lifestyle: {
      type: "array",

      items: {
        type: "string",
      },
    },

    questions_for_doctor: {
      type: "array",

      items: {
        type: "string",
      },
    },

    confidence: {
      type: "number",
    },
  },

  required: [
    "patient_name",
    "condition",
    "summary",
    "medicines",
    "warning_signs",
    "follow_up",
    "lifestyle",
    "questions_for_doctor",
    "confidence",
  ],
};

// ======================================================
// GEMINI SYSTEM INSTRUCTION
// ======================================================

const SYSTEM_INSTRUCTION = `
You are CareBridge, a healthcare discharge-summary
to patient-care-plan assistant.

Your job is to transform a hospital discharge summary
into a simple, patient-friendly care plan.

STRICT MEDICAL SAFETY RULES:

1. Do not diagnose the patient.
2. Do not invent medicines.
3. Do not invent medicine doses.
4. Do not change medicine frequency.
5. Do not change medicine duration.
6. Do not invent follow-up dates.
7. Do not invent clinician instructions.
8. Do not invent laboratory results.
9. Do not invent medical history.
10. Do not invent allergies.
11. Do not invent symptoms.
12. Preserve information from the discharge summary.
13. Simplify medical terminology.
14. Do not create a new treatment plan.
15. Do not tell the patient to stop or change prescribed medicines.
16. If information is missing, clearly state that it was not provided.
17. Do not make assumptions.
18. Warning signs must be supported by the discharge document.
19. Follow-up information must be supported by the discharge document.
20. Lifestyle instructions must be supported by the discharge document.
21. Questions for the doctor may be generated as general questions,
    but they must NOT be presented as medical advice.
22. Return ONLY valid JSON matching the supplied schema.
23. Confidence must be between 0 and 1.
24. Include a medicine route only when it is explicitly stated; otherwise return an empty string.

The output must contain:

- patient_name
- condition
- summary
- medicines
- warning_signs
- follow_up
- lifestyle
- questions_for_doctor
- confidence
`;

// ======================================================
// FILE CLEANUP
// ======================================================

function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      "Could not delete temporary file:",
      error.message
    );
  }
}

// ======================================================
// EXTRACT TEXT FROM FILE
// ======================================================

async function extractTextFromFile(file) {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  console.log("Extracting uploaded document.");

  // ====================================================
  // TXT
  // ====================================================

  if (extension === ".txt") {
    return fs.readFileSync(
      file.path,
      "utf8"
    );
  }

  // ====================================================
  // PDF
  // ====================================================

  if (extension === ".pdf") {
    const buffer = fs.readFileSync(
      file.path
    );

    const parser = new PDFParse({
      data: buffer,
    });

    try {
      const result = await parser.getText();

      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }

  // ====================================================
  // DOCX
  // ====================================================

  if (extension === ".docx") {
    const result =
      await mammoth.extractRawText({
        path: file.path,
      });

    return result.value || "";
  }

  // ====================================================
  // DOC
  // ====================================================

  if (extension === ".doc") {
    throw new Error(
      "Old .DOC files are not supported directly. Convert the file to PDF or DOCX."
    );
  }

  // ====================================================
  // IMAGE
  // ====================================================

  if (
    extension === ".jpg" ||
    extension === ".jpeg" ||
    extension === ".png"
  ) {
    throw new Error(
      "Image extraction is not enabled yet. Please upload the PDF version of the discharge summary."
    );
  }

  throw new Error(
    "Unsupported file format."
  );
}

// ======================================================
// PARSE GEMINI JSON
// ======================================================

function parseGeminiJson(text) {
  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  let cleaned = text.trim();

  // Remove markdown code blocks if Gemini returns them
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini returned invalid structured output.");

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}

// ======================================================
// NORMALIZE CARE PLAN
// ======================================================

function normalizeCarePlan(
  plan,
  patientName = ""
) {
  const medicines =
    Array.isArray(plan?.medicines)
      ? plan.medicines.map(
          (medicine) => ({
            name:
              medicine?.name || "",

            dose:
              medicine?.dose || "",

            route:
              medicine?.route || "",

            frequency:
              medicine?.frequency || "",

            duration:
              medicine?.duration || "",

            instructions:
              medicine?.instructions || "",
          })
        )
      : [];

  const warningSigns =
    Array.isArray(plan?.warning_signs)
      ? plan.warning_signs
      : Array.isArray(plan?.warningSigns)
      ? plan.warningSigns
      : [];

  const followUp =
    Array.isArray(plan?.follow_up)
      ? plan.follow_up
      : Array.isArray(plan?.followUp)
      ? plan.followUp
      : plan?.follow_up
      ? [plan.follow_up]
      : plan?.followUp
      ? [plan.followUp]
      : [];

  const lifestyle =
    Array.isArray(plan?.lifestyle)
      ? plan.lifestyle
      : [];

  const questions =
    Array.isArray(
      plan?.questions_for_doctor
    )
      ? plan.questions_for_doctor
      : Array.isArray(
          plan?.questionsForDoctor
        )
      ? plan.questionsForDoctor
      : [];

  return {
    patientName:
      plan?.patient_name ||
      plan?.patientName ||
      patientName ||
      "Not provided",

    condition:
      plan?.condition ||
      "Not provided",

    summary:
      plan?.summary ||
      "No summary was provided.",

    medicines,

    warningSigns,

    followUp,

    lifestyle,

    questionsForDoctor:
      questions,

    confidence:
      typeof plan?.confidence ===
      "number"
        ? Math.max(
            0,
            Math.min(
              1,
              plan.confidence
            )
          )
        : 0.8,
  };
}

// ======================================================
// GENERATE CARE PLAN WITH GEMINI
// ======================================================

async function generateCarePlan({
  dischargeText,
  language = "English",
  patientName = "",
}) {
  if (!ai) {
    throw new Error(
      "Gemini is not configured. Check GEMINI_API_KEY in backend/.env."
    );
  }

  if (
    !dischargeText ||
    !dischargeText.trim()
  ) {
    throw new Error(
      "No discharge summary text was provided."
    );
  }

  console.log(
    "\n========================================"
  );

  console.log(
    "CARE PLAN GENERATION REQUEST"
  );

  console.log(
    "Language:",
    language
  );

  console.log(
    "Text characters:",
    dischargeText.length
  );

  console.log(
    "AI enabled: true"
  );

  console.log(
    "Calling Gemini model:",
    GEMINI_MODEL
  );

  console.log(
    "========================================"
  );

  const prompt = `
Convert the following hospital discharge summary
into a simple patient-friendly care plan.

TARGET LANGUAGE:
${language}

PATIENT NAME PROVIDED BY APPLICATION:
${patientName || "Not provided"}

DISCHARGE SUMMARY:
==================================================

${dischargeText}

==================================================

IMPORTANT:

Use only information supported by the discharge summary.

Return ONLY valid JSON.
`;

  try {
    // ==================================================
    // GEMINI GENERATE CONTENT API
    // ==================================================

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,

        contents: prompt,

        config: {
          systemInstruction:
            SYSTEM_INSTRUCTION,

          responseMimeType:
            "application/json",

          responseSchema:
            CARE_PLAN_SCHEMA,

          thinkingConfig: {
            thinkingLevel: "low",
          },

          maxOutputTokens: 4096,
        },
      });

    const outputText =
      response?.text;

    if (!outputText) {
      throw new Error(
        "Gemini returned no output."
      );
    }

    console.log(
      "Gemini response received."
    );

    const parsed =
      parseGeminiJson(
        outputText
      );

    const normalized =
      normalizeCarePlan(
        parsed,
        patientName
      );

    console.log(
      "\n========================================"
    );

    console.log(
      "CARE PLAN GENERATED SUCCESSFULLY"
    );

    console.log(
      "========================================"
    );

    return normalized;
  } catch (error) {
    logServerError("Care plan generation failed.", error);

    const withSafeDetails = (message) => {
      const wrapped = new Error(message, { cause: error });
      wrapped.safeDetails = redactSensitiveText(
        error?.message || "Gemini request failed."
      );
      return wrapped;
    };

    // ==================================================
    // 429 - QUOTA
    // ==================================================

    if (
      error?.status === 429 ||
      error?.message
        ?.toLowerCase()
        .includes("quota") ||
      error?.message
        ?.toLowerCase()
        .includes("rate limit") ||
      error?.message
        ?.toLowerCase()
        .includes(
          "resource_exhausted"
        )
    ) {
      throw withSafeDetails(
        "Gemini API quota/rate limit reached for this project/model. Please use a project with available quota or wait for the quota reset."
      );
    }

    // ==================================================
    // 503 - TEMPORARY MODEL CAPACITY
    // ==================================================

    if (
      error?.status === 503 ||
      error?.message
        ?.toLowerCase()
        .includes("high demand") ||
      error?.message
        ?.toLowerCase()
        .includes("unavailable")
    ) {
      throw withSafeDetails(
        `Gemini model ${GEMINI_MODEL} is temporarily unavailable/high demand. Please try again shortly.`
      );
    }

    // ==================================================
    // 400 - BAD REQUEST
    // ==================================================

    if (error?.status === 400) {
      throw withSafeDetails(
        "Gemini rejected the request. Check the server logs for details."
      );
    }

    // ==================================================
    // OTHER ERRORS
    // ==================================================

    throw withSafeDetails(
      "Gemini care-plan generation failed. Check the server logs for details."
    );
  }
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "CareBridge API",

      mode: ai
        ? "AI"
        : "DEMO",

      database: databaseConnected ? "MongoDB" : "Disconnected",

      geminiConnected:
        Boolean(ai),

      geminiModel:
        GEMINI_MODEL,

      timestamp:
        new Date().toISOString(),
    });
  }
);

// ======================================================
// ROOT
// ======================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      service:
        "CareBridge Healthcare API",

      status:
        "running",

      version:
        "1.0.0",

      model:
        GEMINI_MODEL,
    });
  }
);

// ======================================================
// DATABASE AUTHENTICATION AND PATIENT DATA
// ======================================================

app.post("/api/auth/register", async (req, res, next) => {
  try {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) return res.status(503).json({ message: "Account authentication is not configured on the server." });
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return res.status(400).json({ message: "Enter your name, a valid email, and a password with at least 8 characters." });
    }
    const users = getDatabase().collection("users");
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const result = await users.insertOne({ name, email, passwordHash: await hashPassword(password), createdAt: new Date() });
    const user = { id: result.insertedId.toHexString(), name, email };
    return res.status(201).json({ user, token: createToken(user.id) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) return res.status(503).json({ message: "Account authentication is not configured on the server." });
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await getDatabase().collection("users").findOne({ email });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
    return res.json({ user: { id: user._id.toHexString(), name: user.name, email: user.email }, token: createToken(user._id.toHexString()) });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/patient-data", requireAuth, async (req, res, next) => {
  try {
    const data = await getDatabase().collection("patientData").findOne({ userId: req.user.id }, { projection: { _id: 0, userId: 0 } });
    return res.json(data || { history: [], reminders: [], carePlan: null });
  } catch (error) { next(error); }
});

app.put("/api/patient-data", requireAuth, async (req, res, next) => {
  try {
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(0, 500) : [];
    const reminders = Array.isArray(req.body?.reminders) ? req.body.reminders.slice(0, 500) : [];
    const carePlan = req.body?.carePlan && typeof req.body.carePlan === "object" ? req.body.carePlan : null;
    await getDatabase().collection("patientData").updateOne(
      { userId: req.user.id },
      { $set: { history, reminders, carePlan, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    return res.json({ success: true });
  } catch (error) { next(error); }
});

app.patch("/api/patient-data", requireAuth, async (req, res, next) => {
  try {
    const updates = { updatedAt: new Date() };
    for (const key of ["history", "reminders", "carePlan"]) {
      if (!(key in (req.body || {}))) continue;
      if (key === "history" || key === "reminders") {
        if (!Array.isArray(req.body[key])) return res.status(400).json({ message: `${key} must be an array.` });
        updates[key] = req.body[key].slice(0, 500);
      } else updates.carePlan = req.body.carePlan && typeof req.body.carePlan === "object" ? req.body.carePlan : null;
    }
    await getDatabase().collection("patientData").updateOne({ userId: req.user.id }, { $set: updates, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return res.json({ success: true });
  } catch (error) { next(error); }
});

// ======================================================
// DOCUMENT EXTRACTION
// ======================================================

app.post(
  "/api/extract",

  upload.single(
    "document"
  ),

  async (req, res) => {
    console.log(
      "\n========================================"
    );

    console.log(
      "DOCUMENT EXTRACTION REQUEST"
    );

    console.log(
      "========================================"
    );

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,

          message:
            "No document uploaded.",
        });
      }

      console.log("Document received.");

      const text =
        await extractTextFromFile(
          req.file
        );

      if (
        !text ||
        !text.trim()
      ) {
        cleanupFile(
          req.file.path
        );

        return res.status(422).json({
          success: false,

          message:
            "No readable text was found in the document.",
        });
      }

      console.log(
        "Extraction successful."
      );

      console.log(
        "Extracted characters:",
        text.length
      );

      const fileName =
        req.file.originalname;

      const mimeType =
        req.file.mimetype;

      cleanupFile(
        req.file.path
      );

      return res.json({
        success: true,

        text,

        needsVision:
          false,

        imageBase64:
          null,

        mimeType,

        fileName,

        characters:
          text.length,
      });
    } catch (error) {
      logServerError("Document extraction failed.", error);

      if (req.file) {
        cleanupFile(
          req.file.path
        );
      }

      return res.status(500).json({
        success: false,

        message:
          safeErrorMessage(error, "Document extraction failed."),
      });
    }
  }
);

// ======================================================
// CARE PLAN GENERATION
// CURRENT FRONTEND ROUTE
// ======================================================

app.post(
  "/api/careplan/generate",

  async (req, res) => {
    try {
      const {
        text,
        language = "English",
        patientName = "",
      } = req.body;

      if (
        !text ||
        !text.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Discharge summary text is required.",
        });
      }

      const plan =
        await generateCarePlan({
          dischargeText:
            text,

          language,

          patientName,
        });

      return res.json({
        success: true,

        plan,
        language,
        mode: ai ? "AI" : "DEMO",
      });
    } catch (error) {
      logServerError("Care plan route failed.", error);

      return res.status(500).json({
        success: false,

        message:
          safeErrorMessage(error, "Care plan generation failed."),
        ...(!isProduction
          ? { error: error?.safeDetails || safeErrorMessage(error, "Care plan generation failed.") }
          : {}),
      });
    }
  }
);

// ======================================================
// BACKWARD-COMPATIBLE OLD ROUTE
// ======================================================

app.post(
  "/api/care-plan/generate",

  upload.single(
    "file"
  ),

  async (req, res) => {
    try {
      let dischargeText =
        req.body?.text ||
        req.body?.dischargeText ||
        "";

      const language =
        req.body?.language ||
        "English";

      const patientName =
        req.body?.patientName ||
        "";

      if (req.file) {
        dischargeText =
          await extractTextFromFile(
            req.file
          );

        cleanupFile(
          req.file.path
        );
      }

      if (
        !dischargeText ||
        !dischargeText.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "No discharge summary was provided.",
        });
      }

      const plan =
        await generateCarePlan({
          dischargeText,

          language,

          patientName,
        });

      return res.json({
        success: true,

        plan,
      });
    } catch (error) {
      logServerError("Legacy care plan route failed.", error);

      if (req.file) {
        cleanupFile(
          req.file.path
        );
      }

      return res.status(500).json({
        success: false,

        message:
          safeErrorMessage(error, "Care plan generation failed."),
      });
    }
  }
);

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    logServerError("Request failed.", error);

    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        success: false,

        message:
          safeErrorMessage(error, "Upload failed."),
      });
    }

    return res.status(500).json({
      success: false,

      message:
        safeErrorMessage(error, "Internal server error."),
    });
  }
);

// ======================================================
// START SERVER
// ======================================================

async function startServer() {
  try {
    databaseConnected = await ensureDatabaseConnected();
    console.log(databaseConnected ? "MongoDB connected." : "MongoDB is not configured; database routes are unavailable.");
  } catch (error) {
    logServerError("MongoDB connection failed.", error);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      "\n========================================"
    );

    console.log(
      "       CAREBRIDGE API SERVER"
    );

    console.log(
      "========================================"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      `Health: http://localhost:${PORT}/api/health`
    );

    console.log(
      `Extract: http://localhost:${PORT}/api/extract`
    );

    console.log(
      `Care Plan: http://localhost:${PORT}/api/careplan/generate`
    );

    console.log(
      `Gemini: ${
        ai
          ? "CONNECTED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Model: ${GEMINI_MODEL}`
    );

    console.log(`Database: ${databaseConnected ? "MongoDB" : "Disconnected"}`);

    console.log(
      "========================================\n"
    );
  });
}

if (!isNetlifyFunction) {
  startServer();
}
