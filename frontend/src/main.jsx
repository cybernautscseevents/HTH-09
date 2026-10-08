import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Heart,
  HeartPulse,
  Home,
  Languages,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  User,
  Camera,
  X,
} from "lucide-react";
import Auth from "./Auth";
import MedicationReminder from "./MedicationReminder";
import "./styles.css";
const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";
const SAMPLE_SUMMARY = `DISCHARGE SUMMARY
Patient: Rahul Kumar
Diagnosis: Community acquired respiratory infection
Medication:
1. Amoxicillin 500 mg, three times daily, for 5 days, after food.
2. Paracetamol 500 mg, as needed for fever/pain.
Follow-up:
Review with physician after 7 days.
Warning:
Return to hospital if breathing difficulty, severe weakness or persistent high fever occurs.
Advice:
Drink adequate fluids and take adequate rest.`;
/* =========================================================
   APP
========================================================= */
function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved =
        localStorage.getItem("carebridge_user");
    return saved && localStorage.getItem("carebridge_token") ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activePage, setActivePage] =
    useState("home");
  const [sidebarOpen, setSidebarOpen] =
    useState(false);
  const [summary, setSummary] =
    useState("");
  const [language, setLanguage] =
    useState("English");
  const [patientName, setPatientName] =
    useState("");
  const [selectedFile, setSelectedFile] =
    useState(null);
  const [carePlan, setCarePlan] =
    useState(null);
  const [history, setHistory] =
    useState([]);
  const [reminders, setReminders] =
    useState([]);
  const [medicineToRemind, setMedicineToRemind] = useState(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  /* =====================================================
     LOAD LOCAL DATA
  ===================================================== */
  useEffect(() => {
    try {
      const savedHistory =
        localStorage.getItem(
          "carebridge_history"
        );
      const savedReminders =
        localStorage.getItem(
          "carebridge_reminders"
        );
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        setReminders(Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && item.id != null) : []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);
  /* =====================================================
     SAVE HISTORY
     ===================================================== */
  useEffect(() => {
    const token = localStorage.getItem("carebridge_token");
    if (!user || !token) return;
    const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };
    axios.get(`${API}/patient-data`, config).then(({ data }) => {
      const localHistory = (() => { try { return JSON.parse(localStorage.getItem("carebridge_history") || "[]"); } catch { return []; } })();
      const localReminders = (() => { try { return JSON.parse(localStorage.getItem("carebridge_reminders") || "[]"); } catch { return []; } })();
      const historyData = Array.isArray(data.history) && data.history.length ? data.history : localHistory;
      const reminderData = Array.isArray(data.reminders) && data.reminders.length ? data.reminders : localReminders;
      setHistory(historyData); setReminders(reminderData);
      if (data.carePlan || historyData[0]?.carePlan) setCarePlan(data.carePlan || historyData[0].carePlan);
      localStorage.setItem("carebridge_history", JSON.stringify(historyData));
      localStorage.setItem("carebridge_reminders", JSON.stringify(reminderData));
      const migration = { ...(!data.history?.length && localHistory.length ? { history: localHistory } : {}), ...(!data.reminders?.length && localReminders.length ? { reminders: localReminders } : {}), ...(!data.carePlan && localHistory[0]?.carePlan ? { carePlan: localHistory[0].carePlan } : {}) };
      if (Object.keys(migration).length) axios.patch(`${API}/patient-data`, migration, config).catch((err) => console.error("Could not migrate local patient data", err));
    }).catch((err) => {
      console.error("Could not load database patient data", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("carebridge_token");
        localStorage.removeItem("carebridge_user");
        setUser(null);
        setError("Your session expired. Sign in again to access your account.");
      } else setError("Could not load your saved account data. Your local copy is still available.");
    });
  }, [user]);
  const persistPatientField = (field, value) => {
    const token = localStorage.getItem("carebridge_token");
    if (!token) return;
    axios.patch(`${API}/patient-data`, { [field]: value }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }).catch((err) => {
      console.error(`Could not save ${field} to the database`, err);
      setError("Your changes are saved on this device but could not sync to the database.");
    });
  };
  const saveHistory = (items) => {
    setHistory(items);
    localStorage.setItem(
      "carebridge_history",
      JSON.stringify(items)
    );
    persistPatientField("history", items);
  };
  useEffect(() => {
    const checkMedicationReminders = () => {
      if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      let changed = false;
      const next = reminders.map((item) => {
        if (item.type !== "medication" || !Array.isArray(item.times) || (item.endDate && day > item.endDate)) return item;
        const alreadyTakenForThisTime = item.completed && item.lastTakenDate === day && item.lastTakenTime && currentTime <= item.lastTakenTime;
        if (alreadyTakenForThisTime || !item.times.includes(currentTime)) return item;
        const occurrence = `${day}_${currentTime}`;
        if (item.lastNotified?.[occurrence]) return item;
        try {
          new Notification("💊 Dischara Medication Reminder", { body: `Time to take ${item.medicineName}${item.dose ? ` ${item.dose}` : ""}.` });
        } catch (error) { console.error("Could not show medication notification", error); }
        changed = true;
        return { ...item, lastNotified: { ...(item.lastNotified || {}), [occurrence]: true } };
      });
      if (changed) saveReminders(next);
    };
    checkMedicationReminders();
    const timer = window.setInterval(checkMedicationReminders, 30000);
    return () => window.clearInterval(timer);
  }, [reminders]);
  /* =====================================================
     SAVE REMINDERS
  ===================================================== */
  const saveReminders = (items) => {
    setReminders(items);
    localStorage.setItem(
      "carebridge_reminders",
      JSON.stringify(items)
    );
    persistPatientField("reminders", items);
  };
  /* =====================================================
     LOGIN
  ===================================================== */
  const handleLogin = (session) => {
    const loggedInUser = session.user;
    localStorage.setItem("carebridge_token", session.token);
    localStorage.setItem(
      "carebridge_user",
      JSON.stringify(loggedInUser)
    );
    setUser(loggedInUser);
  };
  /* =====================================================
     LOGOUT
  ===================================================== */
  const handleLogout = () => {
    localStorage.removeItem(
      "carebridge_user"
    );
    localStorage.removeItem("carebridge_token");
    setUser(null);
    setCarePlan(null);
    setSummary("");
    setSelectedFile(null);
    setActivePage("home");
  };
  /* =====================================================
     SAMPLE SUMMARY
  ===================================================== */
  const loadSample = () => {
    setSummary(SAMPLE_SUMMARY);
    setPatientName("Rahul Kumar");
    setSelectedFile(null);
    setError("");
    setSuccess(
      "Sample discharge summary loaded."
    );
  };
  /* =====================================================
     FILE SELECTION
  ===================================================== */
  const handleFileChange = async (event) => {
    const file =
      event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError("");
    setSuccess("");
    /*
      TXT files can be previewed immediately.
      PDF/DOCX/images will be processed by backend.
    */
    if (
      file.type === "text/plain" ||
      file.name
        .toLowerCase()
        .endsWith(".txt")
    ) {
      try {
        const text =
          await file.text();
        setSummary(text);
        setSuccess(
          `${file.name} loaded successfully.`
        );
      } catch {
        setError(
          "Could not read the selected text file."
        );
      }
      return;
    }
    setSuccess(
      `${file.name} selected. Click Generate Care Plan.`
    );
  };
  /* =====================================================
     GENERATE CARE PLAN
  ===================================================== */
  const generateCarePlan = async () => {
    setError("");
    setSuccess("");
    if (
      !summary.trim() &&
      !selectedFile
    ) {
      setError(
        "Please paste a discharge summary or upload a document."
      );
      return;
    }
    setLoading(true);
    try {
      let documentText =
        summary.trim();
      let imageBase64 = null;
      let mimeType = null;
      /* =================================================
         STEP 1
         If file selected:
         Send file to /extract
      ================================================= */
      if (selectedFile) {
        const formData =
          new FormData();
        formData.append(
          "document",
          selectedFile
        );
        const extractResponse =
          await axios.post(
            `${API}/extract`,
            formData,
            {
              timeout: 60000,
            }
          );
        const extracted =
          extractResponse.data;
        /*
          PDF / DOCX / TXT
        */
        if (extracted.text) {
          documentText =
            extracted.text;
        }
        /*
          JPG / PNG
          Backend returns base64 image
        */
        if (
          extracted.needsVision &&
          extracted.imageBase64
        ) {
          imageBase64 =
            extracted.imageBase64;
          mimeType =
            extracted.mimeType;
        }
      }
      /* =================================================
         STEP 2
         Generate AI care plan
      ================================================= */
      if (
        !documentText &&
        !imageBase64
      ) {
        throw new Error(
          "No readable information was found in the uploaded file."
        );
      }
      const response =
        await axios.post(
          `${API}/careplan/generate`,
          {
            text: documentText,
            language,
            patientName,
            imageBase64,
            mimeType,
          },
          {
            headers: {
              "Content-Type":
                "application/json",
            },
            timeout: 120000,
          }
        );
      /*
        IMPORTANT:
        Backend returns:
        {
          plan: {...},
          language: "...",
          mode: "AI"
        }
      */
      const backendPlan =
        response.data?.plan;
      if (!backendPlan) {
        throw new Error(
          "The server returned an empty care plan."
        );
      }
      /* =================================================
         NORMALIZE BACKEND RESPONSE
         Backend uses camelCase.
         UI uses snake_case.
      ================================================= */
      const normalizedPlan = {
        patient_name:
          backendPlan.patientName ||
          patientName ||
          "Patient",
        condition:
          backendPlan.condition ||
          "Not specified",
        summary:
          backendPlan.summary ||
          "",
        medicines:
          Array.isArray(
            backendPlan.medicines
          )
            ? backendPlan.medicines
            : [],
        warning_signs:
          Array.isArray(
            backendPlan.warningSigns
          )
            ? backendPlan.warningSigns
            : [],
        follow_up:
          Array.isArray(
            backendPlan.followUp
          )
            ? backendPlan.followUp
            : [],
        lifestyle:
          Array.isArray(
            backendPlan.lifestyle
          )
            ? backendPlan.lifestyle
            : [],
        questions_for_doctor:
          Array.isArray(
            backendPlan.questionsForDoctor
          )
            ? backendPlan.questionsForDoctor
            : [],
        confidence:
          backendPlan.confidence ||
          "medium",
        mode:
          response.data?.mode ||
          "AI",
        language:
          response.data?.language ||
          language,
      };
      /* =================================================
         SAVE CARE PLAN
      ================================================= */
      setCarePlan(
        normalizedPlan
      );
      persistPatientField("carePlan", normalizedPlan);
      const historyItem = {
        id: Date.now(),
        patientName:
          normalizedPlan.patient_name,
        condition:
          normalizedPlan.condition,
        date:
          new Date().toLocaleDateString(
            "en-IN"
          ),
        carePlan:
          normalizedPlan,
      };
      saveHistory([
        historyItem,
        ...history,
      ]);
      setActivePage(
        "careplan"
      );
      setSuccess(
        "Care plan generated successfully."
      );
    } catch (err) {
      console.error(
        "CARE PLAN ERROR:",
        err
      );
      let message =
        "Unable to generate the care plan.";
      if (
        err.code ===
        "ECONNABORTED"
      ) {
        message =
          "The AI request took too long. Please make sure the backend is running.";
      }
      else if (
        err.response?.data?.message
      ) {
        message =
          err.response.data.message;
      }
      else if (
        err.message
      ) {
        message =
          err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  /* =====================================================
     NEW PLAN
  ===================================================== */
  const startNewPlan = () => {
    setSummary("");
    setPatientName("");
    setSelectedFile(null);
    setCarePlan(null);
    setError("");
    setSuccess("");
    setActivePage("home");
  };
  /* =====================================================
     ADD REMINDER
  ===================================================== */
  const addReminder = () => {
    if (!carePlan) return;
    const newReminder = {
      id: Date.now(),
      title:
        "Follow-up appointment",
      description:
        getFollowUpText(
          carePlan.follow_up
        ),
      date: "Follow-up",
      completed: false,
    };
    saveReminders([
      newReminder,
      ...reminders,
    ]);
    setSuccess(
      "Reminder added successfully."
    );
  };
  /* =====================================================
     TOGGLE REMINDER
  ===================================================== */
  const toggleReminder = (id) => {
    const updated =
      reminders.map(
        (item) =>
          item.id === id
          ? {
              ...item,
              completed:
                !item.completed,
              ...(item.type === "medication" ? { lastTakenDate: !item.completed ? new Date().toLocaleDateString("en-CA") : null, lastTakenTime: !item.completed ? `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}` : null } : {}),
              }
            : item
      );
    saveReminders(updated);
  };
  const createMedicationReminder = (data) => {
    const duplicate = reminders.some((item) => item.type === "medication" && item.medicineName?.toLowerCase() === data.medicineName.toLowerCase());
    if (duplicate) { setError(`A reminder for ${data.medicineName} already exists.`); return false; }
    const days = Number(String(data.duration || "").match(/\d+/)?.[0]);
    const end = new Date();
    if (days > 0 && days <= 3650) end.setDate(end.getDate() + days - 1);
    const reminder = { id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: "medication", ...data, startDate: new Date().toLocaleDateString("en-CA"), ...(days > 0 && days <= 3650 ? { endDate: end.toLocaleDateString("en-CA") } : {}), completed: false, lastNotified: {} };
    saveReminders([reminder, ...reminders]);
    setMedicineToRemind(null);
    setError("");
    setSuccess("Medication reminder saved.");
    return true;
  };
  /* =====================================================
     DELETE REMINDER
  ===================================================== */
  const deleteReminder = (id) => {
    const updated =
      reminders.filter(
        (item) =>
          item.id !== id
      );
    saveReminders(updated);
  };
  /* =====================================================
     AUTH
  ===================================================== */
  if (!user) {
    return (
      <Auth
        onLogin={handleLogin}
      />
    );
  }
  /* =====================================================
     DASHBOARD
  ===================================================== */
  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}
      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-icon">
            <HeartPulse size={25} />
          </div>
          <div>
            <div className="brand-name">
              CareBridge
            </div>
            <div className="brand-subtitle">
              Patient Care AI
            </div>
          </div>
          <button
            className="mobile-close"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">
            WORKSPACE
          </div>
          <button
            className={`nav-item ${
              activePage === "home"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActivePage("home");
              setSidebarOpen(false);
            }}
          >
            <Home size={19} />
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${
              activePage === "careplan"
                ? "active"
                : ""
            }`}
            onClick={() => {
              if (carePlan) {
                setActivePage(
                  "careplan"
                );
              }
              setSidebarOpen(false);
            }}
          >
            <ClipboardList size={19} />
            <span>My Care Plan</span>
            {carePlan && (
              <span className="nav-badge">
                1
              </span>
            )}
          </button>
          <button
            className={`nav-item ${
              activePage === "history"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActivePage(
                "history"
              );
              setSidebarOpen(false);
            }}
          >
            <Clock size={19} />
            <span>History</span>
          </button>
          <button
            className={`nav-item ${
              activePage === "reminders"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActivePage(
                "reminders"
              );
              setSidebarOpen(false);
            }}
          >
            <Bell size={19} />
            <span>Reminders</span>
            {reminders.length > 0 && (
              <span className="nav-badge">
                {reminders.length}
              </span>
            )}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-trust">
            <ShieldCheck size={18} />
            <div>
              <strong>
                Your data matters
              </strong>
              <span>
                Your health information
                should always be handled
                with care.
              </span>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">
              {(user.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <strong>
                {user.name ||
                  "User"}
              </strong>
              <span>
                {user.email ||
                  "Patient"}
              </span>
            </div>
            <button
              className="logout-small"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {/* MAIN */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            <Menu size={22} />
          </button>
          <div className="topbar-left">
            <div className="topbar-title">
              {activePage ===
                "home" &&
                "Dashboard"}
              {activePage ===
                "careplan" &&
                "My Care Plan"}
              {activePage ===
                "history" &&
                "Care Plan History"}
              {activePage ===
                "reminders" &&
                "Reminders"}
            </div>
            <div className="topbar-status">
              <span className="status-dot" />
              AI system online
            </div>
          </div>
          <div className="topbar-right">
            <div className="language-selector">
              <Languages size={17} />
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value
                  )
                }
              >
                <option>
                  English
                </option>
                <option>
                  Kannada
                </option>
                <option>
                  Hindi
                </option>
                <option>
                  Tamil
                </option>
                <option>
                  Telugu
                </option>
              </select>
            </div>
            <div className="topbar-avatar">
              {(user.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-content">
          {error && (
            <div className="alert alert-error">
              <AlertTriangle
                size={19}
              />
              <span>
                {error}
              </span>
              <button
                onClick={() =>
                  setError("")
                }
              >
                <X size={17} />
              </button>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <CheckCircle2
                size={19}
              />
              <span>
                {success}
              </span>
              <button
                onClick={() =>
                  setSuccess("")
                }
              >
                <X size={17} />
              </button>
            </div>
          )}
          {activePage ===
            "home" && (
            <Dashboard
              summary={summary}
              setSummary={setSummary}
              patientName={patientName}
              setPatientName={
                setPatientName
              }
              language={language}
              setLanguage={
                setLanguage
              }
              loading={loading}
              selectedFile={
                selectedFile
              }
              handleFileChange={
                handleFileChange
              }
              generateCarePlan={
                generateCarePlan
              }
              loadSample={
                loadSample
              }
              setActivePage={
                setActivePage
              }
              carePlan={carePlan}
              history={history}
            />
          )}
          {activePage ===
            "careplan" && (
          <CarePlanPage
              carePlan={carePlan}
              onNewPlan={
                startNewPlan
              }
            onReminder={
              addReminder
            }
            onSetMedicationReminder={setMedicineToRemind}
            />
          )}
          {activePage ===
            "history" && (
            <HistoryPage
              history={history}
              setCarePlan={
                setCarePlan
              }
              setActivePage={
                setActivePage
              }
            />
          )}
          {activePage ===
            "reminders" && (
            <RemindersPage
              reminders={reminders}
              toggleReminder={
                toggleReminder
              }
            deleteReminder={
                deleteReminder
            }
            onEnableNotifications={async () => {
              if (!("Notification" in window)) { setError("This browser does not support notifications."); return; }
              try { const permission = await Notification.requestPermission(); setSuccess(permission === "granted" ? "Notifications enabled." : "Notification permission was not granted."); }
              catch { setError("Could not request notification permission."); }
            }}
            />
          )}
      </div>
      {medicineToRemind && <MedicationReminder medicine={medicineToRemind} onSave={createMedicationReminder} onCancel={() => setMedicineToRemind(null)} />}
        <footer className="app-footer">
          <div>
            <ShieldCheck size={16} />
            CareBridge is a healthcare
            decision-support tool and does
            not replace professional medical
            advice.
          </div>
          <div className="footer-right">
            <span>
              AI-powered healthcare
            </span>
            <span>•</span>
            <span>
              For educational use
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
/* =========================================================
   DASHBOARD
========================================================= */
function Dashboard({
  summary,
  setSummary,
  patientName,
  setPatientName,
  language,
  setLanguage,
  loading,
  selectedFile,
  handleFileChange,
  generateCarePlan,
  loadSample,
  setActivePage,
  carePlan,
  history,
}) {
  return (
    <>
      {/* HERO */}
      <section className="welcome-section">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} />
            AI-POWERED HEALTHCARE
          </div>
          <h1>
            Understand your.
            <br />
            <span>
              care. Take control.
            </span>
          </h1>
          <p>
            CareBridge transforms complex
            hospital discharge instructions
            into a simple, patient-friendly
            care plan.
          </p>
        </div>
        <div className="hero-health-icon">
          <HeartPulse
            size={92}
            strokeWidth={1.2}
          />
        </div>
      </section>
      {/* STATS */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <FileText size={21} />
          </div>
          <div>
            <strong>
              {history.length}
            </strong>
            <span>
              Care plans created
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2
              size={21}
            />
          </div>
          <div>
            <strong>AI</strong>
            <span>
              Powered analysis
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <Languages size={21} />
          </div>
          <div>
            <strong>5+</strong>
            <span>
              Language support
            </span>
          </div>
        </div>
      </section>
      {/* GENERATOR */}
      <section className="generator-card">
        <div className="section-heading">
          <div className="section-heading-icon">
            <ClipboardList size={21} />
          </div>
          <div>
            <h2>
              Create your care plan
            </h2>
            <p>
              Upload or paste your hospital
              discharge summary and let AI
              simplify it.
            </p>
          </div>
        </div>
        {/* PATIENT + LANGUAGE */}
        <div className="form-grid">
          <div className="form-group">
            <label>
              Patient name
              <span className="optional">
                Optional
              </span>
            </label>
            <div className="input-wrapper">
              <User size={18} />
              <input
                type="text"
                value={patientName}
                onChange={(e) =>
                  setPatientName(
                    e.target.value
                  )
                }
                placeholder="Enter patient name"
              />
            </div>
          </div>
          <div className="form-group">
            <label>
              Output language
            </label>
            <div className="input-wrapper">
              <Languages size={18} />
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value
                  )
                }
              >
                <option>
                  English
                </option>
                <option>
                  Kannada
                </option>
                <option>
                  Hindi
                </option>
                <option>
                  Tamil
                </option>
                <option>
                  Telugu
                </option>
              </select>
            </div>
          </div>
        </div>
        {/* FILE UPLOAD */}
        <div className="upload-box">
          <input
            id="summary-file"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            hidden
          />
          <label
            htmlFor="summary-file"
            className="upload-content"
          >
            <div className="upload-icon">
              <Upload size={25} />
            </div>
            <div>
              <strong>
                {selectedFile
                  ? selectedFile.name
                  : "Upload discharge summary"}
              </strong>
              <span>
                PDF, DOC, DOCX, TXT,
                JPG or PNG
              </span>
            </div>
            <span className="upload-button">
              Browse
            </span>
          </label>
          {/* MOBILE CAMERA */}
          <input
            id="camera-file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            hidden
          />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding:
                "0 18px 15px",
            }}
          >
            <label
              htmlFor="camera-file"
              className="secondary-button"
              style={{
                minHeight: "36px",
                cursor: "pointer",
              }}
            >
              <Camera size={16} />
              Take photo
            </label>
          </div>
        </div>
        {/* DIVIDER */}
        <div className="or-divider">
          <span>
            OR PASTE TEXT
          </span>
        </div>
        {/* TEXT */}
        <div className="textarea-wrapper">
          <textarea
            value={summary}
            onChange={(e) =>
              setSummary(
                e.target.value
              )
            }
            placeholder={`Paste the patient's discharge summary here...
Example:
Diagnosis: Community acquired respiratory infection
Medication: Amoxicillin 500 mg three times daily for 5 days
Follow-up: Review after 7 days
Advice: Take adequate rest and fluids`}
            rows={10}
          />
          <div className="textarea-footer">
            <span>
              {summary.length}
              {" "}
              characters
            </span>
            <button
              className="sample-button"
              onClick={loadSample}
              type="button"
            >
              <RefreshCw size={15} />
              Use sample
            </button>
          </div>
        </div>
        {/* ACTION */}
        <div className="generator-actions">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              Your information is handled
              securely and should be verified
              with your healthcare provider.
            </span>
          </div>
          <button
            className="primary-button generate-button"
            onClick={
              generateCarePlan
            }
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Processing document...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Care Plan
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </section>
      {/* FEATURES */}
      <section className="features-section">
        <div className="section-title-row">
          <div>
            <h2>
              What CareBridge helps
              you understand
            </h2>
            <p>
              Everything important from your
              discharge instructions, explained
              clearly.
            </p>
          </div>
        </div>
        <div className="feature-grid">
          <FeatureCard
            icon={<Pill />}
            title="Understand medicines"
            description="See medicine names, doses, frequency and instructions in an easy-to-follow format."
            className="feature-blue"
          />
          <FeatureCard
            icon={<AlertTriangle />}
            title="Know warning signs"
            description="Clearly identify symptoms that may require urgent medical attention."
            className="feature-red"
          />
          <FeatureCard
            icon={<CalendarDays />}
            title="Never miss follow-up"
            description="Understand when you need to return to your doctor and what to discuss."
            className="feature-green"
          />
          <FeatureCard
            icon={
              <MessageCircleQuestion />
            }
            title="Ask better questions"
            description="Get useful questions to discuss with your healthcare provider."
            className="feature-purple"
          />
        </div>
      </section>
      {/* HOW IT WORKS */}
      <section className="how-section">
        <div className="section-title-row centered">
          <div>
            <div className="eyebrow">
              <Sparkles size={15} />
              SIMPLE BY DESIGN
            </div>
            <h2>
              From discharge summary
              to clarity
            </h2>
            <p>
              Three simple steps to understand
              your post-hospital care.
            </p>
          </div>
        </div>
        <div className="steps-grid">
          <Step
            number="01"
            icon={<Upload />}
            title="Upload"
            description="Upload a PDF, prescription photo, document or paste the discharge summary."
          />
          <Step
            number="02"
            icon={<Activity />}
            title="AI understands"
            description="Our AI extracts and organizes the important medical instructions."
          />
          <Step
            number="03"
            icon={<HeartPulse />}
            title="Take control"
            description="Get a clear, patient-friendly care plan."
          />
        </div>
      </section>
      {carePlan && (
        <section className="recent-card">
          <div>
            <div className="recent-icon">
              <ClipboardList size={21} />
            </div>
            <div>
              <h3>
                Your latest care plan
                is ready
              </h3>
              <p>
                View your personalized
                patient-friendly instructions.
              </p>
            </div>
          </div>
          <button
            className="secondary-button"
            onClick={() =>
              setActivePage(
                "careplan"
              )
            }
          >
            View Care Plan
            <ChevronRight size={17} />
          </button>
        </section>
      )}
    </>
  );
}
/* =========================================================
   CARE PLAN PAGE
========================================================= */
function CarePlanPage({
  carePlan,
  onNewPlan,
  onReminder,
  onSetMedicationReminder,
}) {
  if (!carePlan) {
    return (
      <EmptyState
        icon={
          <ClipboardList
            size={35}
          />
        }
        title="No care plan yet"
        description="Create a care plan from your discharge summary to see it here."
        buttonText="Create Care Plan"
        onClick={onNewPlan}
      />
    );
  }
  const medicines =
    Array.isArray(
      carePlan.medicines
    )
      ? carePlan.medicines
      : [];
  const warnings =
    Array.isArray(
      carePlan.warning_signs
    )
      ? carePlan.warning_signs
      : [];
  const lifestyle =
    Array.isArray(
      carePlan.lifestyle
    )
      ? carePlan.lifestyle
      : [];
  const questions =
    Array.isArray(
      carePlan.questions_for_doctor
    )
      ? carePlan.questions_for_doctor
      : [];
  return (
    <>
      <div className="careplan-header">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} />
            AI-GENERATED CARE PLAN
          </div>
          <h1>
            Your care plan
          </h1>
          <p>
            A simplified version of your
            discharge instructions.
          </p>
        </div>
        <div className="careplan-actions">
          <button
            className="secondary-button"
            onClick={onReminder}
          >
            <Bell size={17} />
            Add reminder
          </button>
          <button
            className="primary-button"
            onClick={onNewPlan}
          >
            <Plus size={17} />
            New plan
          </button>
        </div>
      </div>
      {/* OVERVIEW */}
      <section className="overview-card">
        <div className="overview-icon">
          <Stethoscope size={25} />
        </div>
        <div className="overview-content">
          <span>
            Patient
          </span>
          <h2>
            {carePlan.patient_name ||
              "Patient"}
          </h2>
        </div>
        <div className="overview-condition">
          <span>
            Condition
          </span>
          <strong>
            {carePlan.condition ||
              "Not specified"}
          </strong>
        </div>
        <div className="ai-verified">
          <Sparkles size={15} />
          {carePlan.mode ===
          "DEMO"
            ? "Demo mode"
            : "AI summarized"}
        </div>
      </section>
      {/* GRID */}
      <div className="careplan-grid">
        {/* MEDICINES */}
        <section className="care-section">
          <SectionHeader
            icon={<Pill />}
            title="Your medicines"
            description="Follow the medication instructions provided by your healthcare team."
            variant="blue"
          />
          {medicines.length > 0 ? (
            <div className="medicine-list">
              {medicines.map(
                (
                  medicine,
                  index
                ) => (
                  <div
                    className="medicine-card"
                    key={index}
                  >
                    <div className="medicine-number">
                      {index + 1}
                    </div>
                    <div className="medicine-content">
                      <h3>
                        {medicine.name ||
                          "Medicine"}
                      </h3>
                      <div className="medicine-meta">
                        {medicine.dose && (
                          <span>
                            <strong>
                              Dose:
                            </strong>{" "}
                            {medicine.dose}
                          </span>
                        )}
                        {medicine.frequency && (
                          <span>
                            <strong>
                              Frequency:
                            </strong>{" "}
                            {medicine.frequency}
                          </span>
                        )}
                        {medicine.duration && (
                          <span>
                            <strong>
                              Duration:
                            </strong>{" "}
                            {medicine.duration}
                          </span>
                        )}
                        {medicine.route && (
                          <span>
                            <strong>
                              Route:
                            </strong>{" "}
                            {medicine.route}
                          </span>
                        )}
                      </div>
                  {medicine.instructions && (
                        <div className="medicine-instruction">
                          <CheckCircle2
                            size={15}
                          />
                          {medicine.instructions}
                        </div>
                  )}
                  <button className="secondary-button medication-set-reminder" onClick={() => onSetMedicationReminder(medicine)}><Bell size={15} /> Set Reminder</button>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyMini text="No medicine information was identified." />
          )}
        </section>
        {/* WARNING */}
        <section className="care-section">
          <SectionHeader
            icon={
              <AlertTriangle />
            }
            title="Warning signs"
            description="Seek medical attention if any of these symptoms occur."
            variant="red"
          />
          {warnings.length > 0 ? (
            <ul className="warning-list">
              {warnings.map(
                (
                  warning,
                  index
                ) => (
                  <li key={index}>
                    <AlertTriangle
                      size={17}
                    />
                    <span>
                      {warning}
                    </span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <EmptyMini text="No warning signs were identified." />
          )}
        </section>
        {/* FOLLOW UP */}
        <section className="care-section followup-section">
          <SectionHeader
            icon={
              <CalendarDays />
            }
            title="Follow-up"
            description="Keep track of your next healthcare appointment."
            variant="green"
          />
          <div className="followup-box">
            <CalendarDays
              size={25}
            />
            <div>
              <span>
                Recommended follow-up
              </span>
              <p>
                {getFollowUpText(
                  carePlan.follow_up
                )}
              </p>
            </div>
          </div>
        </section>
        {/* LIFESTYLE */}
        <section className="care-section">
          <SectionHeader
            icon={<Heart />}
            title="Daily care & lifestyle"
            description="Simple steps that may support your recovery."
            variant="purple"
          />
          {lifestyle.length > 0 ? (
            <div className="lifestyle-list">
              {lifestyle.map(
                (
                  item,
                  index
                ) => (
                  <div
                    className="lifestyle-item"
                    key={index}
                  >
                    <CheckCircle2
                      size={18}
                    />
                    <span>
                      {item}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyMini text="No lifestyle guidance was identified." />
          )}
        </section>
        {/* QUESTIONS */}
        <section className="care-section">
          <SectionHeader
            icon={
              <MessageCircleQuestion />
            }
            title="Questions for your doctor"
            description="Useful questions you can discuss during your next visit."
            variant="orange"
          />
          {questions.length > 0 ? (
            <div className="questions-list">
              {questions.map(
                (
                  question,
                  index
                ) => (
                  <div
                    className="question-item"
                    key={index}
                  >
                    <span>
                      {index + 1}
                    </span>
                    <p>
                      {question}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyMini text="No suggested questions were generated." />
          )}
        </section>
      </div>
      <div className="medical-disclaimer">
        <ShieldCheck size={18} />
        <div>
          <strong>
            Important
          </strong>
          <p>
            This care plan is an AI-generated
            simplification of the provided
            discharge information. It does not
            diagnose conditions, prescribe
            medicines, or replace advice from a
            qualified healthcare professional.
            Always verify medication and treatment
            instructions against your original
            discharge summary.
          </p>
        </div>
      </div>
    </>
  );
}
/* =========================================================
   HISTORY
========================================================= */
function HistoryPage({
  history,
  setCarePlan,
  setActivePage,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Clock size={15} />
            YOUR RECORD
          </div>
          <h1>
            Care plan history
          </h1>
          <p>
            Previously generated care plans
            are stored locally on this device.
          </p>
        </div>
      </div>
      {history.length === 0 ? (
        <EmptyState
          icon={<Clock size={35} />}
          title="No history yet"
          description="Your generated care plans will appear here."
          buttonText="Create your first plan"
          onClick={() =>
            setActivePage("home")
          }
        />
      ) : (
        <div className="history-list">
          {history.map(
            (item) => (
              <div
                className="history-card"
                key={item.id}
              >
                <div className="history-icon">
                  <ClipboardList
                    size={21}
                  />
                </div>
                <div className="history-main">
                  <div className="history-top">
                    <h3>
                      {item.patientName}
                    </h3>
                    <span>
                      {item.date}
                    </span>
                  </div>
                  <p>
                    {item.condition}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setCarePlan(
                      item.carePlan
                    );
                    setActivePage(
                      "careplan"
                    );
                  }}
                >
                  View
                  <ChevronRight
                    size={16}
                  />
                </button>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
/* =========================================================
   REMINDERS
========================================================= */
function RemindersPage({
  reminders,
  toggleReminder,
  deleteReminder,
  onEnableNotifications,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Bell size={15} />
            STAY ON TRACK
      </div>
      <button className="secondary-button" onClick={onEnableNotifications}><Bell size={16} /> Enable Notifications</button>
          <h1>
            Reminders
          </h1>
          <p>
            Keep important follow-up tasks
            in one place.
          </p>
        </div>
      </div>
      {reminders.length === 0 ? (
        <EmptyState
          icon={<Bell size={35} />}
          title="No reminders"
          description="Add a reminder from your care plan when you need to remember an important follow-up."
        />
      ) : (
        <div className="reminders-list">
          {reminders.map(
            (reminder) => (
              <div
                className={`reminder-card ${
                  reminder.completed
                    ? "completed"
                    : ""
                }`}
                key={reminder.id}
              >
                <button
                  className="reminder-check"
                  onClick={() =>
                    toggleReminder(
                      reminder.id
                    )
                  }
                >
                  <CheckCircle2
                    size={23}
                  />
                </button>
                <div className="reminder-content">
                <h3>{reminder.type === "medication" ? `💊 ${reminder.medicineName}` : reminder.title}</h3>
                {reminder.type === "medication" ? <>
                  <p>{reminder.dose || "Dose not specified"} · {reminder.frequency || "Frequency not specified"} · {reminder.duration || "Duration not specified"}</p>
                  {reminder.instructions && <p>{reminder.instructions}</p>}
                  {reminder.times?.length > 0 && <div className="reminder-times">{reminder.times.map((time) => <span key={time}><Clock size={13} /> {new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>)}</div>}
                  <span>{reminder.completed ? "Taken today" : "Active"}{reminder.endDate ? ` · Through ${reminder.endDate}` : ""}</span>
                  <button className="secondary-button" onClick={() => toggleReminder(reminder.id)}>{reminder.completed ? "Undo" : "Mark as Taken"}</button>
                </> : <><p>{reminder.description}</p><span>
                  <CalendarDays
                      size={14}
                    />
                  {reminder.date}
                </span><button className="secondary-button" onClick={() => toggleReminder(reminder.id)}>{reminder.completed ? "Undo" : "Mark as Taken"}</button></>}
                </div>
                <button
                  className="delete-reminder"
                  onClick={() =>
                    deleteReminder(
                      reminder.id
                    )
                  }
                >
                  <X size={18} />
                </button>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
/* =========================================================
   SMALL COMPONENTS
========================================================= */
function FeatureCard({
  icon,
  title,
  description,
  className = "",
}) {
  return (
    <div
      className={`feature-card ${className}`}
    >
      <div className="feature-icon">
        {icon}
      </div>
      <h3>
        {title}
      </h3>
      <p>
        {description}
      </p>
    </div>
  );
}
function Step({
  number,
  icon,
  title,
  description,
}) {
  return (
    <div className="step-card">
      <div className="step-number">
        {number}
      </div>
      <div className="step-icon">
        {icon}
      </div>
      <h3>
        {title}
      </h3>
      <p>
        {description}
      </p>
    </div>
  );
}
function SectionHeader({
  icon,
  title,
  description,
  variant,
}) {
  return (
    <div className="care-section-header">
      <div
        className={`care-header-icon ${variant}`}
      >
        {icon}
      </div>
      <div>
        <h2>
          {title}
        </h2>
        <p>
          {description}
        </p>
      </div>
    </div>
  );
}
function EmptyMini({
  text,
}) {
  return (
    <div className="empty-mini">
      <FileText size={20} />
      <span>
        {text}
      </span>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  buttonText,
  onClick,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon}
      </div>
      <h2>
        {title}
      </h2>
      <p>
        {description}
      </p>
      {buttonText &&
        onClick && (
          <button
            className="primary-button"
            onClick={onClick}
          >
            <Plus size={17} />
            {buttonText}
          </button>
        )}
    </div>
  );
}
/* =========================================================
   FOLLOW-UP HELPER
========================================================= */
function getFollowUpText(
  followUp
) {
  if (!followUp) {
    return "Not specified in document";
  }
  if (typeof followUp === "string") {
    return followUp;
  }
  if (Array.isArray(followUp)) {
    if (followUp.length === 0) {
      return "Not specified in document";
    }
    return followUp
      .map((item) => {
        if (
          typeof item ===
          "string"
        ) {
          return item;
        }
        const parts = [];
        if (item.date) {
          parts.push(
            `Date: ${item.date}`
          );
        }
        if (item.department) {
          parts.push(
            `Department: ${item.department}`
          );
        }
        if (item.instruction) {
          parts.push(
            item.instruction
          );
        }
        return parts.join(" • ");
      })
      .join("\n");
  }
  return "Check the original discharge summary for follow-up instructions.";
}
/* =========================================================
   START APP
========================================================= */
ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
