import { useState, useEffect, useCallback, useRef } from "react";
import {
  FaBell,
  FaPlus,
  FaClock,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

import Navbar from "../components/Navbar";
import api from "../services/api";
import "../styles/Reminder.css";

const INITIAL_FORM = {
  medicine: "",
  medicine_id: "",
  disease: "",
  dosage: "",
  time: "",
  schedule: "",
  repeat: "Daily",
  startDate: "",
  endDate: "",
  push: true,
  email: false,
  sms: false,
  whatsapp: false,
  status: "Pending",
};

/* ======================================================
   SCHEDULE OPTIONS (Morning / Afternoon / Evening / Night)
   The schedule is a UI helper only: picking one suggests a
   default time, but the actual reminder ALWAYS fires using
   the final saved date + time.
====================================================== */
const SCHEDULE_OPTIONS = ["Morning", "Afternoon", "Evening", "Night"];
const SCHEDULE_DEFAULT_TIMES = {
  Morning: "08:00",
  Afternoon: "13:00",
  Evening: "18:00",
  Night: "21:00",
};

/* ======================================================
   EXACT-TIME SCHEDULER HELPERS
   All times are parsed/compared in the USER'S LOCAL
   timezone. No UTC is hardcoded anywhere.
====================================================== */
const FIRED_STORAGE_KEY = "pillsync_fired_reminders_v1";

// Max safe setTimeout delay (~24.8 days). Longer horizons are
// re-scheduled in chunks so notifications never fire early/late.
const MAX_TIMEOUT_DELAY = 2147483000;

// Unique key for a reminder schedule. Changes whenever the
// date or time is edited, so an edited reminder can fire again.
const getReminderKey = (item) =>
  `${item.id}|${item.reminder_date}|${item.reminder_time}`;

// Build a local Date from reminder_date (YYYY-MM-DD) and
// reminder_time (HH:MM[:SS]) using the browser's local timezone.
// Returns null for invalid/legacy values so they never get scheduled.
const getTargetDate = (item) => {
  if (!item.reminder_date || !item.reminder_time) return null;
  const [y, m, d] = item.reminder_date.split("-").map(Number);
  const [hh, mm] = item.reminder_time.split(":").map(Number);
  if (
    !y || !m || !d ||
    Number.isNaN(hh) || Number.isNaN(mm) ||
    m < 1 || m > 12 || d < 1 || d > 31 ||
    hh < 0 || hh > 23 || mm < 0 || mm > 59
  ) {
    return null; // invalid date/time — never scheduled
  }
  const target = new Date(y, m - 1, d, hh, mm, 0, 0);
  // Round-trip check: reject impossible dates (e.g. Feb 31) that the
  // Date constructor would silently roll over to a different day.
  if (
    target.getFullYear() !== y ||
    target.getMonth() !== m - 1 ||
    target.getDate() !== d
  ) {
    return null;
  }
  return target;
};

// Persisted map of already-fired reminders { key: firedAtISO }.
// Prevents duplicate notifications across refreshes and keeps
// each reminder triggering exactly once.
const loadFiredMap = () => {
  try {
    return JSON.parse(localStorage.getItem(FIRED_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFiredMap = (map) => {
  try {
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — fire-once still guarded in-session */
  }
};

const isAlreadyFired = (key) =>
  Object.prototype.hasOwnProperty.call(loadFiredMap(), key);

// Local-timezone date string (YYYY-MM-DD) for the default start date.
const getLocalDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/* ======================================================
   TIME NORMALIZATION HELPERS
   The <input type="time"> value can be locale-dependent
   (some browsers return "05:32 PM" in 12-hour locales).
   We ALWAYS send/compare 24-hour "HH:MM" to the backend
   so the stored time exactly matches what the user picked.
====================================================== */
const normalizeTime24h = (value) => {
  if (!value) return "";
  const m = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return value;
  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const ampm = m[3] ? m[3].toUpperCase() : "";
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

// Format a 24-hour "HH:MM[:SS]" time as "HH:MM AM/PM" (e.g. "05:32 PM").
const formatTime12h = (value) => {
  if (!value) return "";
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minute} ${suffix}`;
};

function Reminders() {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [medicinesList, setMedicinesList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);

  /* ── Exact-time scheduler state ── */
  const timersRef = useRef({}); // id -> setTimeout id (exact firing)
  const firedSessionRef = useRef(new Set()); // keys fired this session
  const scheduledKeysRef = useRef(new Set()); // keys scheduled this session
  const timeManuallySetRef = useRef(false); // Improvement 2: never overwrite manual time

  const showToast = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  }, []);

  const getMedicineName = useCallback(
    (medicineId) => {
      const med = medicinesList.find((m) => m.id === medicineId);
      return med ? med.medicine_name : `Medicine #${medicineId}`;
    },
    [medicinesList]
  );

  const getMedicineDosage = useCallback(
    (medicineId) => {
      const med = medicinesList.find((m) => m.id === medicineId);
      return med ? med.dosage : "—";
    },
    [medicinesList]
  );

  const sendNotification = useCallback(
    (medicine, time) => {
      const fallback = () =>
        showToast("info", `⏰ Time to take ${medicine} at ${time}`);
      if (!("Notification" in window)) {
      // Browser Notification API unsupported → in-app toast
      fallback();
      return;
    }
      if (Notification.permission === "granted") {
        new Notification("💊 PillSync Reminder", {
          body: `Time to take ${medicine} at ${time}`,
          icon: "/vite.svg",
        });
        return;
      }
      // "default" → permission was already requested once on page load
      // (see mount effect). Never re-request here; show an in-app toast
      // instead so the user still gets the reminder.
      fallback();
    },
    [showToast]
  );

  /* ========== Fetch data from API ========== */
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("access");
    if (!token) {
      showToast("error", "Please login first");
      setPageLoading(false);
      return;
    }
    try {
      const [medRes, remRes] = await Promise.all([
        api.get("medicines/"),
        api.get("reminders/"),
      ]);
      setMedicinesList(medRes.data);
      setReminders(remRes.data);
      console.log("Reminder Loaded:", { count: remRes.data.length, items: remRes.data });
    } catch (error) {
      showToast("error", "Failed to load data from server");
      console.error(error);
    } finally {
      setPageLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Request notification permission exactly once (only when undecided).
     Never re-requests after the user has answered (granted/denied). */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Remember a manually chosen time so schedule selection never overwrites it
    if (name === "time" && value) timeManuallySetRef.current = true;
    // For time inputs, prefer valueAsNumber (always milliseconds since
    // midnight, locale-independent) so the 24-hour value is never wrong.
    let finalValue = value;
    if (name === "time" && e.target.type === "time") {
      const vn = e.target.valueAsNumber;
      if (Number.isFinite(vn)) {
        const d = new Date(vn);
        finalValue = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
          d.getUTCMinutes()
        ).padStart(2, "0")}`;
      } else {
        finalValue = normalizeTime24h(value);
      }
    }
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : finalValue,
    });
  };

  /* Schedule is only a helper: picking one suggests a default time.
     If the user already chose a time manually, it is NEVER overwritten. */
  const handleScheduleChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      schedule: value,
      time:
        !timeManuallySetRef.current && SCHEDULE_DEFAULT_TIMES[value]
          ? SCHEDULE_DEFAULT_TIMES[value]
          : prev.time,
    }));
  };

  /* ========== Save / Update Reminder ========== */
  const saveReminder = async () => {
    if (!formData.medicine_id || !formData.time) {
      showToast("error", "Please select a medicine and set a time");
      return;
    }

    // Validate schedule: only Morning / Afternoon / Evening / Night accepted
    if (formData.schedule && !SCHEDULE_OPTIONS.includes(formData.schedule)) {
      showToast(
        "error",
        "Invalid schedule. Choose Morning, Afternoon, Evening or Night."
      );
      return;
    }

    setSaving(true);
    const payload = {
      medicine: formData.medicine_id,
      // Always send a canonical 24-hour time so PM/AM is never lost
      reminder_time: normalizeTime24h(formData.time),
      // Default start date uses the user's LOCAL timezone (never UTC)
      reminder_date: formData.startDate || getLocalDateString(),
      status: "PENDING",
    };

    try {
      if (editId !== null) {
        await api.patch(`reminders/${editId}/`, payload);
        showToast("success", "Reminder updated successfully");
      } else {
        await api.post("reminders/", payload);
        showToast("success", "Reminder created successfully");
        // NOTE: no immediate notification here — the scheduler fires it
        // exactly at the saved date + time.
      }

      await fetchData();
      setFormData(INITIAL_FORM);
      setEditId(null);
      setShowModal(false);
      timeManuallySetRef.current = false; // fresh form for next reminder
    } catch (error) {
      const msg =
        error.response?.data?.medicine?.[0] ||
        error.response?.data?.detail ||
        "Something went wrong. Please try again.";
      showToast("error", msg);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  /* ========== Edit Reminder ========== */
  const editReminder = (reminder) => {
    setEditId(reminder.id);
    // The saved time is authoritative — schedule changes must never
    // overwrite it (Improvement 2).
    timeManuallySetRef.current = true;
    setFormData({
      medicine: getMedicineName(reminder.medicine),
      medicine_id: reminder.medicine,
      disease: reminder.disease || "",
      dosage: getMedicineDosage(reminder.medicine),
      time: (reminder.reminder_time || "").substring(0, 5),
      schedule: reminder.schedule || "",
      repeat: reminder.repeat || "Daily",
      startDate: reminder.reminder_date || "",
      endDate: reminder.endDate || "",
      push: reminder.push !== undefined ? reminder.push : true,
      email: reminder.email || false,
      sms: reminder.sms || false,
      whatsapp: reminder.whatsapp || false,
      status: reminder.status || "Pending",
    });
    setShowModal(true);
  };

  /* ========== Delete Reminder ========== */
  const confirmDelete = (reminder) => {
    setDeleteTarget(reminder);
    setShowConfirm(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await api.delete(`reminders/${deleteTarget.id}/`);
      console.log("Reminder Deleted:", { id: deleteTarget.id });
      showToast("success", "Reminder deleted successfully");
      await fetchData();
    } catch (error) {
      showToast("error", "Failed to delete reminder");
      console.error(error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setDeleteTarget(null);
    }
  };

  /* ========== Export CSV ========== */
  const exportCSV = () => {
    const rows = [["Medicine", "Time", "Date", "Status"]];
    reminders.forEach((item) => {
      rows.push([
        getMedicineName(item.medicine),
        item.reminder_time || "",
        item.reminder_date || "",
        item.status || "",
      ]);
    });
    const csv = rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MedicationHistory.csv";
    a.click();
  };

  /* ========== Update status (Taken/Missed) via API ========== */
  const updateStatus = async (reminder, newStatus) => {
    setLoading(true);
    try {
      await api.patch(`reminders/${reminder.id}/`, { status: newStatus });
      showToast("success", `Reminder marked as ${newStatus}`);
      await fetchData();
    } catch (error) {
      showToast("error", "Failed to update status");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /* ========== Snooze Reminder (postpone by SNOOZE_MINUTES) ==========
     Snoozing shifts the saved reminder_date + reminder_time forward by
     SNOOZE_MINUTES via the API. The exact-time scheduler re-reads those
     fields when fetchData() refreshes the list, so the reminder fires
     again at the NEW time. Because the schedule key (id|date|time)
     changes, duplicate-prevention and refresh-recovery keep working. */
  const SNOOZE_MINUTES = 10;

  const handleSnooze = async (reminder) => {
    const target = getTargetDate(reminder);
    if (!target) {
      showToast("error", "Cannot snooze: reminder has an invalid date or time");
      return;
    }
    setLoading(true);
    try {
      target.setMinutes(target.getMinutes() + SNOOZE_MINUTES);
      const pad = (n) => String(n).padStart(2, "0");
      const newDate = `${target.getFullYear()}-${pad(
        target.getMonth() + 1
      )}-${pad(target.getDate())}`;
      const newTime = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
      await api.patch(`reminders/${reminder.id}/`, {
        reminder_date: newDate,
        reminder_time: newTime,
      });
      showToast("success", `Snoozed — will remind again at ${newTime}`);
      await fetchData();
    } catch (error) {
      showToast("error", "Failed to snooze reminder");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /* ========== Compute stats ========== */
  const totalReminders = reminders.length;
  const takenCount = reminders.filter(
    (item) => item.status === "TAKEN" || item.status === "Taken"
  ).length;
  const adherence =
    totalReminders === 0
      ? 0
      : Math.round((takenCount / totalReminders) * 100);

  const pendingReminders = reminders.filter(
    (item) => item.status === "PENDING" || item.status === "Pending"
  );

  const nextReminder =
    pendingReminders.length > 0 ? pendingReminders[0] : null;

  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    return timeStr.substring(0, 5);
  };

  const [countdown, setCountdown] = useState("--:--:--");

  useEffect(() => {
    if (!nextReminder || !nextReminder.reminder_time) return;
    const timer = setInterval(() => {
      const now = new Date();
      const [hour, minute] = nextReminder.reminder_time.split(":");
      const target = new Date();
      target.setHours(Number(hour));
      target.setMinutes(Number(minute));
      target.setSeconds(0);
      let diff = target - now;
      if (diff < 0) diff += 24 * 60 * 60 * 1000;
      const h = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
      const m = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextReminder]);

  /* Fire a reminder exactly once: shows the browser notification AND tells
     the backend to send the email + mark the reminder TRIGGERED at the exact
     same moment. The fired marker persists so it never fires again. */
  const fireReminder = useCallback(
    (item) => {
      const key = getReminderKey(item);
      // Exactly-once guards (in-session + persisted across refreshes)
      if (firedSessionRef.current.has(key)) return;
      if (isAlreadyFired(key)) return;
      firedSessionRef.current.add(key);

      const map = loadFiredMap();
      map[key] = new Date().toISOString();
      // Prune entries older than 30 days to keep storage bounded
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      Object.keys(map).forEach((k) => {
        if (new Date(map[k]).getTime() < cutoff) delete map[k];
      });
      saveFiredMap(map);

      // Browser notification shows the same AM/PM formatting as the email
      console.log("Browser Notification Sent:", {
        medicine: getMedicineName(item.medicine),
        time: formatTime12h(item.reminder_time),
      });
      sendNotification(getMedicineName(item.medicine), formatTime12h(item.reminder_time));

      // Email + TRIGGERED must fire exactly with the browser notification.
      // POST /reminders/{id}/trigger/ executes the backend synchronously
      // (no Celery/Redis required). Fire-and-forget; the list catch-up on the
      // backend is the safety net if this request fails.
      api
        .post(`reminders/${item.id}/trigger/`)
        .then((res) => {
          const data = res.data || {};
          console.log("Email Sent / Reminder Completed:", { reminderId: item.id, backendStatus: data.status, emailSent: data.email_sent, data });
          // Reflect TRIGGERED status locally so the card updates immediately.
          // If the backend reports an email failure it keeps the reminder
          // PENDING for retry, so only flip to TRIGGERED when it succeeded.
          if (data.status === "triggered") {
            setReminders((prev) =>
              prev.map((r) =>
                r.id === item.id ? { ...r, status: "TRIGGERED" } : r
              )
            );
          }
        })
        .catch((err) => {
          console.error("Reminder trigger request failed:", err?.response?.data || err.message);
        });
    },
    [sendNotification, getMedicineName]
  );

  /* ==========================================================
     EXACT-TIME SCHEDULER (Improvement 1)
     - One setTimeout per pending reminder, scheduled for the
       exact saved date+time in the user's local timezone.
     - On edit/delete the reminders list changes → all timers are
       cleared and re-registered (old schedule cancelled).
     - Past/expired reminders are never scheduled.
     - Already-fired reminders (persisted in localStorage) are
       skipped so each reminder triggers exactly once.
     - Long horizons (> ~24 days) are re-chunked so setTimeout
       never overflows its max delay.
  ========================================================== */
  useEffect(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};

    const now = Date.now();
    console.log("Scheduler Started:", { currentDateTime: new Date(now).toString() });
    reminders.forEach((item) => {
      const status = (item.status || "").toUpperCase();
      if (status !== "PENDING") {
        console.log("Reminder Skipped:", { id: item.id, reason: `status=${item.status}` });
        return; // only pending reminders fire
      }
      const target = getTargetDate(item);
      if (!target) {
        console.log("Reminder Skipped:", { id: item.id, reason: "invalid date/time" });
        return; // invalid/legacy date+time — never fires
      }

      let delay = target.getTime() - now;
      if (delay <= 0) {
        console.log("Reminder Skipped:", { id: item.id, reason: "past due" });
        return; // expired reminder — never fires again
      }

      const key = getReminderKey(item);
      if (firedSessionRef.current.has(key) || isAlreadyFired(key)) {
        console.log("Reminder Skipped:", { id: item.id, reason: "already fired" });
        return;
      }

      scheduledKeysRef.current.add(key);

      console.log("Reminder Scheduled:", {
        id: item.id,
        targetDateTime: target.toString(),
        currentDateTime: new Date(now).toString(),
        millisecondsRemaining: delay,
      });

      const arm = () => {
        delay = target.getTime() - Date.now();
        if (delay <= 0) {
          delete timersRef.current[item.id];
          console.log("Scheduler Triggered:", { id: item.id, targetDateTime: target.toString() });
          fireReminder(item);
          return;
        }
        const chunk = Math.min(delay, MAX_TIMEOUT_DELAY);
        console.log("Reminder Rescheduled:", { id: item.id, millisecondsRemaining: delay });
        timersRef.current[item.id] = setTimeout(arm, chunk);
      };
      arm();
    });

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      console.log("Reminder Cancelled:", { clearedTimers: Object.keys(timersRef.current).length });
      timersRef.current = {};
    };
  }, [reminders, fireReminder]);

  /* Catch-up safety net: fires reminders that became due while the
     tab was backgrounded (timers throttled) — still exactly-once.
     Reminders that were already past on page load are never fired. */
  const runCatchUp = useCallback(() => {
    const now = Date.now();
    reminders.forEach((item) => {
      const status = (item.status || "").toUpperCase();
      if (status !== "PENDING") return;
      const target = getTargetDate(item);
      if (!target || target.getTime() > now) return;
      const key = getReminderKey(item);
      if (!scheduledKeysRef.current.has(key)) return; // past on load
      if (firedSessionRef.current.has(key) || isAlreadyFired(key)) return;
      fireReminder(item);
    });
  }, [reminders, fireReminder]);

  useEffect(() => {
    const interval = setInterval(runCatchUp, 30000);
    const onVisibility = () => {
      if (!document.hidden) runCatchUp();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runCatchUp]);

  if (pageLoading) {
    return (
      <>
        <Navbar />
        <div className="loading-overlay">
          <div className="loading-spinner">
            <FaSpinner className="spinner-icon" />
            <p>Loading reminders...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      {/* Toast Messages */}
      {message.text && (
        <div className={`message-toast ${message.type}`}>
          {message.type === "success" ? (
            <FaCheckCircle />
          ) : message.type === "error" ? (
            <FaExclamationCircle />
          ) : (
            <FaExclamationTriangle />
          )}
          {message.text}
        </div>
      )}

      {/* Loading Overlay */}
      {(loading || saving) && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <FaSpinner className="spinner-icon" />
            <p>{saving ? "Saving..." : "Processing..."}</p>
          </div>
        </div>
      )}

      <div className="reminder-page">
        {/* Header */}
        <div className="reminder-header">
          <div>
            <h1>Reminder System</h1>
            <p>Manage all medicine reminders</p>
          </div>
          <button
            className="add-btn"
            onClick={() => {
              setFormData(INITIAL_FORM);
              setEditId(null);
              timeManuallySetRef.current = false; // fresh form → schedule can suggest a time
              setShowModal(true);
            }}
          >
            <FaPlus />
            Add Reminder
          </button>
        </div>

        {/* Today's Summary */}
        <div className="summary-grid">
          <div className="summary-card">
            <h3>Total Reminders</h3>
            <h1>{reminders.length}</h1>
          </div>
          <div className="summary-card">
            <h3>Pending</h3>
            <h1>{pendingReminders.length}</h1>
          </div>
          <div className="summary-card">
            <h3>Taken</h3>
            <h1>{takenCount}</h1>
          </div>
        </div>

        {/* Next Dose Countdown */}
        <div className="countdown-card">
          <div className="countdown-left">
            <div className="countdown-icon">⏳</div>
            <div>
              <h2>Next Dose</h2>
              <h3>
                {nextReminder
                  ? getMedicineName(nextReminder.medicine)
                  : "No Reminder"}
              </h3>
              <p>
                <span>🕒 {formatTime(nextReminder?.reminder_time)}</span>
                <span>📅 {nextReminder?.reminder_date}</span>
              </p>
            </div>
          </div>
          <div className="countdown-right">
            <h1>{countdown}</h1>
            <p>Remaining</p>
          </div>
        </div>

        {/* Medication Adherence */}
        <div className="adherence-card">
          <div className="adherence-top">
            <h2>Medication Adherence</h2>
            <h1>{adherence}%</h1>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${adherence}%` }}
            ></div>
          </div>
          <p>
            {takenCount} of {totalReminders} reminders completed
          </p>
        </div>

        {/* Reminder Cards */}
        <div className="reminder-grid">
          {reminders.length === 0 ? (
            <div className="empty">
              <h2>No Reminder Added</h2>
              <p>Click on Add Reminder to create your first reminder</p>
            </div>
          ) : (
            reminders.map((item) => (
              <div className="reminder-card" key={item.id}>
                <div className="card-top">
                  <div>
                    <h2>{getMedicineName(item.medicine)}</h2>
                    <p>
                      <b>Dosage :</b> {getMedicineDosage(item.medicine)}
                    </p>
                    <p>{item.schedule || ""}</p>
                  </div>
                  <FaBell className="bell" />
                </div>

                <div className="time">
                  <FaClock />
                  <span>{formatTime(item.reminder_time)}</span>
                </div>

                <div className="info">
                  <p>
                    Date : <b>{item.reminder_date}</b>
                  </p>
                  <p>
                    Status :
                    <b> {item.status}</b>
                  </p>
                </div>

                <div className="notify">
                  <span>🔔 Push</span>
                </div>

                <div className="actions">
                  <button
                    className="taken-btn"
                    onClick={() => updateStatus(item, "TAKEN")}
                    disabled={loading}
                  >
                    Taken
                  </button>
                  <button
                    className="missed-btn"
                    onClick={() => updateStatus(item, "MISSED")}
                    disabled={loading}
                  >
                    Missed
                  </button>
                  <button
                    className="snooze-btn"
                    onClick={() => handleSnooze(item)}
                    disabled={loading}
                  >
                    Snooze
                  </button>
                  <FaEdit
                    className="icon"
                    onClick={() => editReminder(item)}
                  />
                  <FaTrash
                    className="icon delete"
                    onClick={() => confirmDelete(item)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming Notifications */}
        <div className="notification-panel">
          <h2>Upcoming Notifications</h2>
          {pendingReminders.length === 0 ? (
            <p>No Upcoming Notifications</p>
          ) : (
            pendingReminders.map((item) => (
              <div key={item.id} className="notification-card">
                <div>
                  <h3>{getMedicineName(item.medicine)}</h3>
                  <p>{formatTime(item.reminder_time)}</p>
                </div>
                <span>{item.reminder_date}</span>
              </div>
            ))
          )}
        </div>

        {/* Reminder History */}
        <div className="history">
          <div className="history-top">
            <h2>Reminder History</h2>
            <button className="export-btn" onClick={exportCSV}>
              Export CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Time</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((item) => (
                <tr key={item.id}>
                  <td>{getMedicineName(item.medicine)}</td>
                  <td>{formatTime(item.reminder_time)}</td>
                  <td>{item.reminder_date}</td>
                  <td>
                    <span
                      className={`status ${(item.status || "").toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Reminder Modal (Compact) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>{editId !== null ? "Edit Reminder" : "Add Reminder"}</h2>

            <select
              name="medicine"
              value={formData.medicine}
              onChange={(e) => {
                const selected = medicinesList.find(
                  (item) => item.medicine_name === e.target.value
                );
                if (selected) {
                  // Only accept a valid schedule value from the medicine's
                  // frequency; anything else keeps the current schedule.
                  const freq = selected.frequency || "";
                  const validFreq = SCHEDULE_OPTIONS.includes(freq)
                    ? freq
                    : formData.schedule;
                  setFormData({
                    ...formData,
                    medicine: selected.medicine_name,
                    medicine_id: selected.id,
                    dosage: selected.dosage || "",
                    schedule: validFreq,
                  });
                }
              }}
            >
              <option value="">Select Medicine</option>
              {medicinesList.map((item) => (
                <option key={item.id} value={item.medicine_name}>
                  {item.medicine_name}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={formData.disease}
              placeholder="Disease (optional)"
              name="disease"
              onChange={handleChange}
            />

            <div className="form-row">
              <input
                type="text"
                value={formData.dosage}
                placeholder="Dosage (auto-filled)"
                readOnly
              />
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <select
                name="schedule"
                value={formData.schedule}
                onChange={handleScheduleChange}
              >
                <option value="">Schedule</option>
                {SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <select
                name="repeat"
                value={formData.repeat}
                onChange={handleChange}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div className="form-row">
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                placeholder="Start Date"
              />
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                placeholder="End Date"
              />
            </div>

            <h3>Notification</h3>
            <div className="notify-grid">
              <label>
                <input
                  type="checkbox"
                  name="push"
                  checked={formData.push}
                  onChange={handleChange}
                />
                Push
              </label>
              <label>
                <input
                  type="checkbox"
                  name="email"
                  checked={formData.email}
                  onChange={handleChange}
                />
                Email
              </label>
              <label>
                <input
                  type="checkbox"
                  name="sms"
                  checked={formData.sms}
                  onChange={handleChange}
                />
                SMS
              </label>
              <label>
                <input
                  type="checkbox"
                  name="whatsapp"
                  checked={formData.whatsapp}
                  onChange={handleChange}
                />
                WhatsApp
              </label>
            </div>

            <div className="modal-buttons">
              <button onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button onClick={saveReminder} disabled={saving}>
                {saving ? (
                  <>
                    <FaSpinner style={{ marginRight: 6 }} /> Saving...
                  </>
                ) : editId !== null ? (
                  "Update Reminder"
                ) : (
                  "Save Reminder"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirm && deleteTarget && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <FaExclamationTriangle />
            </div>
            <h3>Delete Reminder</h3>
            <p>
              Are you sure you want to delete the reminder for{" "}
              <strong>{getMedicineName(deleteTarget.medicine)}</strong>?
            </p>
            <div className="confirm-buttons">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowConfirm(false);
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>
              <button className="btn-delete" onClick={executeDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Reminders;
