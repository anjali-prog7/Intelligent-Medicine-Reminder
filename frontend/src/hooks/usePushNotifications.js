import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// The backend queues a PUSH NotificationLog every time a reminder fires.
// This hook consumes that existing queue (GET
// /api/reminders/notification-logs/pending-push/) and displays a browser
// Notification for each entry — using the LIVE medicine/time data returned
// by the backend, never hardcoded values.
//
// - Permission is requested once, only while the browser still shows
//   "default" (undecided). It is never re-requested after grant/deny.
// - Entries are de-duplicated by log id (persisted in sessionStorage so
//   navigating between pages never shows the same notification twice).
// - Clicking the notification focuses the app and opens the Reminders page.
// - Missing Notification API or denied permission never crash the app.

const SHOWN_KEY = "pillsync_shown_push_logs";
const DEFAULT_POLL_MS = 15000;

const loadShown = () => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const saveShown = (set) => {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — de-dup still works within this session */
  }
};

function usePushNotifications({ pollIntervalMs = DEFAULT_POLL_MS } = {}) {
  const navigate = useNavigate();
  const shownRef = useRef(loadShown());

  useEffect(() => {
    // Notification API not available in this browser — nothing to do.
    if (!("Notification" in window)) return;

    // Ask once, only while undecided (never after grant/deny).
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const showNotification = (item) => {
      if (!item || item.id == null) return;
      if (shownRef.current.has(item.id)) return;
      // Only mark as shown once we can actually display it.
      if (Notification.permission !== "granted") return;
      shownRef.current.add(item.id);
      saveShown(shownRef.current);

      try {
        const body =
          item.body ||
          `${item.medicine || "Medication"}${
            item.dosage ? ` ${item.dosage}` : ""
          }${item.time ? ` - ${item.time}` : ""}`;
        const notification = new Notification(
          item.title || "💊 PillSync Reminder",
          { body, icon: "/vite.svg" }
        );
        notification.onclick = () => {
          window.focus();
          if (item.reminder_id) {
            navigate("/reminders");
          }
        };
      } catch (err) {
        console.error("Failed to show browser notification:", err);
      }
    };

    const poll = async () => {
      // Only poll when a user is logged in.
      if (!localStorage.getItem("access")) return;
      try {
        const res = await api.get(
          "reminders/notification-logs/pending-push/"
        );
        if (!Array.isArray(res.data)) return;
        res.data.forEach(showNotification);
      } catch (err) {
        // The push feed being unavailable must never crash the page.
        console.error(
          "Push notification poll failed:",
          err?.response?.status || err.message
        );
      }
    };

    // Poll immediately, then on an interval. Re-poll on tab focus so
    // notifications queued while the tab was backgrounded still appear.
    poll();
    const interval = setInterval(poll, pollIntervalMs);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [navigate, pollIntervalMs]);

  return null;
}

export default usePushNotifications;
