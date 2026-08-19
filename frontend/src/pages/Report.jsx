import { useEffect, useState } from "react";
import {
  FaSpinner,
  FaFileDownload,
  FaEye,
  FaRedo,
  FaTimes,
  FaPills,
} from "react-icons/fa";
import { HiDocumentReport } from "react-icons/hi";

import Sidebar from "../components/Sidebar";
import DashboardTopNav from "../components/DashboardTopNav";
import api from "../services/api";
import "../styles/Report.css";

/* ======================================================
   MEDICATION REPORT — dedicated report page.

   Exactly three actions:
     1. Generate Report  — pulls the logged-in user's LIVE data
        from the existing PillSync APIs
        (GET /api/medicines/, GET /api/reminders/,
         GET /api/accounts/profile/) and builds the report from
        those real values. Nothing is hardcoded or invented.
     2. View Report      — shows the generated report in a
        full-screen viewer inside the app (no navigation away).
     3. Download Report  — downloads the generated report as a
        self-contained HTML file. The project has no PDF library,
        so HTML is the supported format: it opens in any browser
        and can be printed to PDF from there.

   All summary numbers use the exact same conventions as the
   Dashboard (adherence = taken / total reminders).
====================================================== */

const STATUS_LABELS = {
  TAKEN: "Taken",
  MISSED: "Missed",
  SNOOZED: "Snoozed",
  PENDING: "Pending",
  TRIGGERED: "Triggered",
};

const MEDICINE_TYPE_LABELS = {
  TABLET: "Tablet",
  CAPSULE: "Capsule",
  SYRUP: "Syrup",
  INJECTION: "Injection",
};

// Format a 24-hour "HH:MM[:SS]" time as "HH:MM AM/PM".
const formatTime12h = (value) => {
  if (!value) return "--:--";
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minute} ${suffix}`;
};

// Format a "YYYY-MM-DD" date as "15 Aug 2026".
const formatDate = (value) => {
  if (!value) return "--";
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Format a Date object as "15 Aug 2026, 3:42 PM".
const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Summary numbers from the SAME live data (and conventions) the
// rest of the app uses — never invented values.
const buildStats = (medicines, reminders) => {
  const total = reminders.length;
  const taken = reminders.filter((r) => r.status === "TAKEN").length;
  const missed = reminders.filter((r) => r.status === "MISSED").length;
  const pending = reminders.filter((r) => r.status === "PENDING").length;
  const snoozed = reminders.filter((r) => r.status === "SNOOZED").length;
  return {
    totalMedicines: medicines.length,
    activeMedicines: medicines.filter((m) => m.is_active).length,
    totalReminders: total,
    taken,
    missed,
    pending,
    snoozed,
    adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0,
  };
};

// Reminders joined with their medicine name/dosage, newest first.
const decorateReminders = (reminders, medById) =>
  [...reminders]
    .map((r) => {
      const med = medById.get(r.medicine) || {};
      return {
        ...r,
        medicineName: med.medicine_name || `Medicine #${r.medicine}`,
        dosage: med.dosage || "",
      };
    })
    .sort((a, b) =>
      `${b.reminder_date}T${b.reminder_time || "00:00"}`.localeCompare(
        `${a.reminder_date}T${a.reminder_time || "00:00"}`
      )
    );

// Escape a value so it is safe to embed inside the downloadable HTML file.
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

// Build the self-contained HTML content of the downloadable report file.
const buildReportHtml = (report, userData) => {
  const { medicines, reminders, medById, stats, generatedAt } = report;
  const sortedReminders = decorateReminders(reminders, medById);
  const hasData = medicines.length > 0 || reminders.length > 0;

  const summaryCells = [
    ["Total Medicines", stats.totalMedicines],
    ["Active Medicines", stats.activeMedicines],
    ["Total Reminders", stats.totalReminders],
    ["Taken", stats.taken],
    ["Missed", stats.missed],
    ["Pending", stats.pending],
    ["Snoozed", stats.snoozed],
    ["Adherence Rate", `${stats.adherenceRate}%`],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`
    )
    .join("");

  const medicineRows = medicines
    .map(
      (m) => `<tr>
        <td>${esc(m.medicine_name)}</td>
        <td>${esc(MEDICINE_TYPE_LABELS[m.medicine_type] || m.medicine_type)}</td>
        <td>${esc(m.dosage)}</td>
        <td>${esc(m.frequency)}</td>
        <td>${esc(formatTime12h(m.reminder_time))}</td>
        <td>${esc(String(m.stock))}</td>
        <td>${m.is_active ? "Active" : "Inactive"}</td>
        <td>${esc(formatDate(m.start_date))} – ${esc(formatDate(m.end_date))}</td>
      </tr>`
    )
    .join("");

  const reminderRows = sortedReminders
    .map(
      (r) => `<tr>
        <td>${esc(r.medicineName)}</td>
        <td>${esc(r.dosage || "—")}</td>
        <td>${esc(formatDate(r.reminder_date))}</td>
        <td>${esc(formatTime12h(r.reminder_time))}</td>
        <td>${esc(STATUS_LABELS[r.status] || r.status)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PillSync Medication Report</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    background: #F5F7FA;
    color: #0F172A;
  }
  .doc { max-width: 860px; margin: 24px auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px 36px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #0F766E; padding-bottom: 18px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #0F766E, #14B8A6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: -0.4px; }
  .brand p { margin: 2px 0 0; font-size: 12px; color: #64748B; }
  .meta { text-align: right; font-size: 12.5px; color: #475569; line-height: 1.7; }
  .meta p { margin: 0; }
  .section { margin-bottom: 26px; }
  .section h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #0F766E; border-bottom: 1px solid #D7E7E4; padding-bottom: 8px; margin: 0 0 14px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; }
  .stat span { display: block; font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
  .stat b { font-size: 18px; color: #0F172A; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #F0FDFA; color: #0F766E; text-align: left; padding: 9px 10px; border-bottom: 2px solid #99F6E4; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 9px 10px; border-bottom: 1px solid #E2E8F0; color: #334155; }
  tr:last-child td { border-bottom: none; }
  .empty { border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 40px 20px; text-align: center; color: #64748B; font-size: 14px; }
  .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 11.5px; color: #94A3B8; text-align: center; }
  @media (max-width: 640px) { .doc { padding: 20px; } .head { flex-direction: column; } .meta { text-align: left; } .stats { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
  <div class="doc">
    <div class="head">
      <div class="brand">
        <div class="logo">💊</div>
        <div><h1>PillSync</h1><p>Medication Report</p></div>
      </div>
      <div class="meta">
        <p>Generated: ${esc(formatDateTime(generatedAt))}</p>
        <p>Patient: ${esc(userData.username || "User")}</p>
      </div>
    </div>

    ${
      hasData
        ? `
    <div class="section">
      <h2>Summary</h2>
      <div class="stats">${summaryCells}</div>
    </div>

    ${
      medicines.length > 0
        ? `<div class="section">
      <h2>Medicines (${medicines.length})</h2>
      <table>
        <thead><tr><th>Medicine</th><th>Type</th><th>Dosage</th><th>Frequency</th><th>Reminder Time</th><th>Stock</th><th>Status</th><th>Duration</th></tr></thead>
        <tbody>${medicineRows}</tbody>
      </table>
    </div>`
        : ""
    }

    ${
      reminders.length > 0
        ? `<div class="section">
      <h2>Reminder History (${reminders.length})</h2>
      <table>
        <thead><tr><th>Medicine</th><th>Dosage</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
        <tbody>${reminderRows}</tbody>
      </table>
    </div>`
        : ""
    }
    `
        : `
    <div class="empty">No medication data available yet. Add medicines and reminders to generate a report.</div>
    `
    }

    <div class="footer">Generated by PillSync — Medicine Reminder</div>
  </div>
</body>
</html>`;
};

/* ── In-app report viewer (rendered with real JSX) ── */
function ReportViewer({ report, userData, onClose, onDownload }) {
  const { medicines, reminders, medById, stats, generatedAt } = report;
  const sortedReminders = decorateReminders(reminders, medById);
  const hasData = medicines.length > 0 || reminders.length > 0;

  const summaryCells = [
    { label: "Total Medicines", value: stats.totalMedicines },
    { label: "Active Medicines", value: stats.activeMedicines },
    { label: "Total Reminders", value: stats.totalReminders },
    { label: "Taken", value: stats.taken },
    { label: "Missed", value: stats.missed },
    { label: "Pending", value: stats.pending },
    { label: "Snoozed", value: stats.snoozed },
    { label: "Adherence Rate", value: `${stats.adherenceRate}%` },
  ];

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div className="report-modal-title">
            <span className="report-modal-title-icon">
              <HiDocumentReport />
            </span>
            Medication Report
          </div>
          <div className="report-modal-actions">
            <button
              type="button"
              className="report-btn report-btn-primary report-btn-sm"
              onClick={onDownload}
            >
              <FaFileDownload /> Download Report
            </button>
            <button
              type="button"
              className="report-modal-close"
              onClick={onClose}
              aria-label="Close report"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="report-modal-body">
          <div className="report-doc">
            <div className="report-doc-head">
              <div className="report-doc-brand">
                <span className="report-doc-logo">💊</span>
                <div>
                  <h2>PillSync</h2>
                  <p>Medication Report</p>
                </div>
              </div>
              <div className="report-doc-meta">
                <p>Generated: {formatDateTime(generatedAt)}</p>
                <p>Patient: {userData.username || "User"}</p>
              </div>
            </div>

            {!hasData ? (
              <div className="report-doc-empty">
                No medication data available yet. Add medicines and reminders
                to generate a report.
              </div>
            ) : (
              <>
                <div className="report-doc-section">
                  <h3>Summary</h3>
                  <div className="report-doc-summary-grid">
                    {summaryCells.map((cell) => (
                      <div className="report-doc-stat" key={cell.label}>
                        <span>{cell.label}</span>
                        <b>{cell.value}</b>
                      </div>
                    ))}
                  </div>
                </div>

                {medicines.length > 0 && (
                  <div className="report-doc-section">
                    <h3>Medicines ({medicines.length})</h3>
                    <div className="report-doc-table-wrap">
                      <table className="report-doc-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Type</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Reminder Time</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {medicines.map((m) => (
                            <tr key={m.id}>
                              <td>{m.medicine_name}</td>
                              <td>
                                {MEDICINE_TYPE_LABELS[m.medicine_type] ||
                                  m.medicine_type}
                              </td>
                              <td>{m.dosage}</td>
                              <td>{m.frequency}</td>
                              <td>{formatTime12h(m.reminder_time)}</td>
                              <td>{m.stock}</td>
                              <td>{m.is_active ? "Active" : "Inactive"}</td>
                              <td>
                                {formatDate(m.start_date)} –{" "}
                                {formatDate(m.end_date)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reminders.length > 0 && (
                  <div className="report-doc-section">
                    <h3>Reminder History ({reminders.length})</h3>
                    <div className="report-doc-table-wrap">
                      <table className="report-doc-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedReminders.map((r) => (
                            <tr key={r.id}>
                              <td>{r.medicineName}</td>
                              <td>{r.dosage || "—"}</td>
                              <td>{formatDate(r.reminder_date)}</td>
                              <td>{formatTime12h(r.reminder_time)}</td>
                              <td>{STATUS_LABELS[r.status] || r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="report-doc-footer">
              Generated by PillSync — Medicine Reminder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Report() {
  const [medicines, setMedicines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [userData, setUserData] = useState({
    username: "User",
    role: "Patient",
  });
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [showViewer, setShowViewer] = useState(false);

  // Populate the top navbar with the real profile when the page opens.
  useEffect(() => {
    let cancelled = false;
    api
      .get("accounts/profile/")
      .then((res) => {
        if (!cancelled && res.data) {
          setUserData({
            username: res.data.username || "User",
            role: res.data.role || "Patient",
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Generate the report from the user's LIVE PillSync data.
  const generateReport = async () => {
    setGenerating(true);
    setGenerateError("");
    try {
      const [medRes, remRes, profileRes] = await Promise.all([
        api.get("medicines/"),
        api.get("reminders/"),
        api.get("accounts/profile/").catch(() => null),
      ]);
      const meds = Array.isArray(medRes.data) ? medRes.data : [];
      const rems = Array.isArray(remRes.data) ? remRes.data : [];

      if (profileRes?.data) {
        setUserData({
          username: profileRes.data.username || "User",
          role: profileRes.data.role || "Patient",
        });
      }

      setMedicines(meds);
      setReminders(rems);
      setReport({
        medicines: meds,
        reminders: rems,
        medById: new Map(meds.map((m) => [m.id, m])),
        stats: buildStats(meds, rems),
        generatedAt: new Date(),
      });
    } catch (err) {
      console.error("Report generation failed:", err);
      setGenerateError(
        "Could not generate your report. Please check your connection and try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  // Download the generated report as a real file.
  const handleDownload = () => {
    if (!report) return;
    const html = buildReportHtml(report, userData);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PillSync-Medication-Report-${report.generatedAt
      .toISOString()
      .slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasReport = report !== null;

  return (
    <div className="report-layout">
      <Sidebar />

      <div className="report-content-wrapper">
        <DashboardTopNav
          userData={userData}
          medicines={medicines}
          reminders={reminders}
        />

        <div className="report-content">
          <div className="report-inner">
            {/* ── Page Header ── */}
            <div className="report-page-header">
              <div className="report-page-title">
                <span className="report-page-title-icon">
                  <HiDocumentReport />
                </span>
                Medication Report
              </div>
              <p className="report-page-subtitle">
                Generate, view and download your medication report from your
                PillSync data.
              </p>
            </div>

            {generating && (
              <div className="report-generating">
                <FaSpinner className="report-spinner" />
                <span>Generating your report...</span>
              </div>
            )}

            {!generating && generateError && (
              <div className="report-error">{generateError}</div>
            )}

            {/* ── Step 1: Generate Report ── */}
            {!generating && !hasReport && (
              <div className="report-action-card">
                <div className="report-action-icon">
                  <HiDocumentReport />
                </div>
                <h3>Generate Report</h3>
                <p>
                  Create a medication report from your existing PillSync
                  medicines and reminder data.
                </p>
                <button
                  type="button"
                  className="report-btn report-btn-primary report-btn-lg"
                  onClick={generateReport}
                >
                  <HiDocumentReport /> Generate Report
                </button>
              </div>
            )}

            {/* ── Steps 2 & 3: View Report / Download Report ── */}
            {!generating && hasReport && (
              <div className="report-ready-card">
                <div className="report-ready-info">
                  <span className="report-ready-icon">
                    <FaPills />
                  </span>
                  <div>
                    <h3>Your report is ready</h3>
                    <p>
                      Generated from your live PillSync data on{" "}
                      {formatDateTime(report.generatedAt)}.
                    </p>
                  </div>
                </div>
                <div className="report-ready-actions">
                  <button
                    type="button"
                    className="report-btn report-btn-primary"
                    onClick={() => setShowViewer(true)}
                  >
                    <FaEye /> View Report
                  </button>
                  <button
                    type="button"
                    className="report-btn report-btn-outline"
                    onClick={handleDownload}
                  >
                    <FaFileDownload /> Download Report
                  </button>
                  <button
                    type="button"
                    className="report-btn report-btn-ghost"
                    onClick={generateReport}
                  >
                    <FaRedo /> Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showViewer && report && (
        <ReportViewer
          report={report}
          userData={userData}
          onClose={() => setShowViewer(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

export default Report;
