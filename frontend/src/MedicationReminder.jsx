import React, { useMemo, useState } from "react";
import { Bell, Plus, X } from "lucide-react";

const value = (medicine, keys) => {
  for (const key of keys) if (medicine?.[key] != null && String(medicine[key]).trim()) return String(medicine[key]);
  return "";
};

export function suggestedTimes(frequency) {
  const f = String(frequency || "").toLowerCase();
  if (/as needed|\bprn\b/.test(f)) return [];
  if (/every\s*6\s*hours|q6h/.test(f)) return ["06:00", "12:00", "18:00", "00:00"];
  if (/every\s*8\s*hours|q8h/.test(f)) return ["08:00", "16:00", "00:00"];
  if (/every\s*12\s*hours|q12h/.test(f)) return ["08:00", "20:00"];
  if (/\b(qid|four times|4 times)\b/.test(f)) return ["08:00", "12:00", "16:00", "20:00"];
  if (/\b(tid|three times|3 times)\b/.test(f)) return ["08:00", "14:00", "20:00"];
  if (/\b(bid|twice|two times|2 times)\b/.test(f)) return ["08:00", "20:00"];
  if (/once|daily|once a day|\bod\b/.test(f)) return ["08:00"];
  return ["08:00"];
}

export default function MedicationReminder({ medicine, onSave, onCancel }) {
  const name = value(medicine, ["name", "medicineName", "medicine_name", "drug"]);
  const dose = value(medicine, ["dose", "dosage", "strength"]);
  const frequency = value(medicine, ["frequency", "freq", "schedule"]);
  const duration = value(medicine, ["duration", "courseDuration", "course_duration"]);
  const instructions = value(medicine, ["instructions", "instruction", "notes", "route"]);
  const suggestions = useMemo(() => suggestedTimes(frequency), [frequency]);
  const [times, setTimes] = useState(suggestions);
  const [error, setError] = useState("");
  const addTime = () => setTimes((current) => [...current, "08:00"]);
  const updateTime = (index, time) => setTimes((current) => current.map((item, i) => i === index ? time : item));
  const removeTime = (index) => setTimes((current) => current.filter((_, i) => i !== index));
  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) return setError("Medicine name is missing.");
    if (!times.length || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return setError("Add at least one valid reminder time.");
    onSave({ medicineName: name.trim(), dose, frequency, duration, instructions, times: [...new Set(times)].sort() });
  };
  return <div className="reminder-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <form className="reminder-modal" onSubmit={submit}>
      <div className="reminder-modal-heading"><div><span className="eyebrow"><Bell size={14} /> MEDICATION REMINDER</span><h2>{name || "Set reminder"}</h2></div><button type="button" className="delete-reminder" onClick={onCancel} aria-label="Close"><X size={20} /></button></div>
      <div className="reminder-medicine-summary"><strong>{dose || "Dose not specified"}</strong><span>{frequency || "Frequency not specified"}</span><span>{duration || "Duration not specified"}</span>{instructions && <span>{instructions}</span>}</div>
      <p className="reminder-medical-note">Suggested times are only reminders. Follow your doctor's prescribed instructions and timing.</p>
      {/as needed|\bprn\b/i.test(frequency) && <p className="reminder-medical-note">As needed — no automatic schedule. Choose a time only if you want an optional reminder.</p>}
      <label className="reminder-field-label">Reminder times</label>
      {times.map((time, index) => <div className="reminder-time-row" key={index}><input aria-label={`Reminder time ${index + 1}`} type="time" value={time} onChange={(event) => updateTime(index, event.target.value)} required /><button className="delete-reminder" type="button" onClick={() => removeTime(index)} aria-label="Remove time"><X size={17} /></button></div>)}
      <button type="button" className="secondary-button" onClick={addTime}><Plus size={15} /> Add a time</button>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="reminder-modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button"><Bell size={15} /> Save reminder</button></div>
    </form>
  </div>;
}
