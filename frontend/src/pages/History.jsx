import { useEffect, useMemo, useState } from "react";
import {
  FaHistory,
  FaPills,
  FaCalendarAlt,
  FaClock,
  FaSearch,
  FaFilter,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaBell,
} from "react-icons/fa";

import Sidebar from "../components/Sidebar";
import DashboardTopNav from "../components/DashboardTopNav";
import api from "../services/api";
import "../styles/History.css";

/* ======================================================
   Medication History — read-only view of the patient's
   existing medication activity. History records are built
   from the EXISTING reminders API data (the same source
   the Reminders page uses), so Taken / Missed / Snoozed
   statuses reflect whatever the user has marked in the
   application — nothing is hardcoded.
====================================================== */

const STATUS_LABELS = {
  TAKEN: "Taken",
  MISSED: "Missed",
  SNOOZED: "Snoozed",
  PENDING: "Pending",
  TRIGGERED: "Triggered",
};

const STATUS_OPTIONS = ["TAKEN", "MISSED", "SNOOZED", "PENDING", "TRIGGERED"];

const STATUS_ICONS = {
  TAKEN: <FaCheckCircle />,
  MISSED: <FaTimesCircle />,
  SNOOZED: <FaClock />,
  PENDING: <FaBell />,
  TRIGGERED: <FaBell />,
};

// Format a 24-hour "HH:MM[:SS]" time as "HH:MM AM/PM" (e.g. "05:32 PM").
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

// Format a "YYYY-MM-DD" date as "15 Aug 2026" (works even without a server).
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

function History() {
  const [medicines, setMedicines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [medicineFilter, setMedicineFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [medRes, remRes] = await Promise.all([
          api.get("medicines/"),
          api.get("reminders/"),
        ]);
        if (cancelled) return;
        setMedicines(medRes.data);
        setReminders(remRes.data);
      } catch (err) {
        if (!cancelled) {
          setLoadError("Could not load medication history. Please try again.");
          console.error("History page load failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const medById = useMemo(
    () => new Map(medicines.map((m) => [m.id, m])),
    [medicines]
  );

  /* Build the history records from existing reminder data.
     Each reminder is one medication activity record: medicine,
     date, time, status and dosage (when the medicine has one). */
  const allRecords = useMemo(() => {
    return reminders
      .map((r) => {
        const med = medById.get(r.medicine) || {};
        const status = String(r.status || "PENDING").toUpperCase();
        return {
          id: r.id,
          medicineName: med.medicine_name || `Medicine #${r.medicine}`,
          medicineType: med.medicine_type || "",
          dosage: med.dosage || "",
          date: r.reminder_date || "",
          time: r.reminder_time || "",
          status,
          statusLabel: STATUS_LABELS[status] || status,
          schedule: r.recurring_interval || "",
        };
      })
      .sort((a, b) => {
        const ta = `${a.date}T${a.time || "00:00"}`;
        const tb = `${b.date}T${b.time || "00:00"}`;
        return tb.localeCompare(ta); // newest first
      });
  }, [reminders, medById]);

  const medicineOptions = useMemo(() => {
    const seen = new Set();
    const names = [];
    allRecords.forEach((r) => {
      if (!seen.has(r.medicineName)) {
        seen.add(r.medicineName);
        names.push(r.medicineName);
      }
    });
    return names;
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRecords.filter((r) => {
      if (dateFilter && r.date !== dateFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (medicineFilter && r.medicineName !== medicineFilter) return false;
      if (q && !r.medicineName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRecords, dateFilter, statusFilter, medicineFilter, searchQuery]);

  const stats = useMemo(
    () => ({
      total: allRecords.length,
      taken: allRecords.filter((r) => r.status === "TAKEN").length,
      missed: allRecords.filter((r) => r.status === "MISSED").length,
      snoozed: allRecords.filter((r) => r.status === "SNOOZED").length,
    }),
    [allRecords]
  );

  const hasFilters = Boolean(
    dateFilter || statusFilter || medicineFilter || searchQuery.trim()
  );

  const clearFilters = () => {
    setDateFilter("");
    setStatusFilter("");
    setMedicineFilter("");
    setSearchQuery("");
  };

  const renderEmpty = () => (
    <div className="history-empty">
      <div className="history-empty-icon">
        <FaHistory />
      </div>
      <h3>No medication history yet</h3>
      <p>
        Your medication activity will appear here after you take, miss, or
        snooze a reminder.
      </p>
    </div>
  );

  const renderNoMatch = () => (
    <div className="history-empty">
      <div className="history-empty-icon">
        <FaSearch />
      </div>
      <h3>No matching records</h3>
      <p>
        No medication activity matches the current filters. Try adjusting or
        clearing them.
      </p>
      {hasFilters && (
        <button className="history-clear-inline" onClick={clearFilters}>
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="history-layout">
      <Sidebar />
      <div className="history-content-wrapper">
        <DashboardTopNav
          userData={{ username: "User", role: "Patient" }}
          medicines={medicines}
          reminders={reminders}
        />
        <div className="history-content">
          <div className="history-inner">
            {/* ── Page Header ── */}
            <div className="history-page-header">
              <div>
                <div className="history-page-title">
                  <span className="history-page-title-icon">
                    <FaHistory />
                  </span>
                  Medication History
                </div>
                <p className="history-page-subtitle">
                  View and track your medication activity
                </p>
              </div>
              {!loading && allRecords.length > 0 && (
                <span className="history-header-badge">
                  {allRecords.length} record{allRecords.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {loading && (
              <div className="history-loading">
                <FaSpinner className="history-spinner" />
                <span>Loading medication history...</span>
              </div>
            )}

            {!loading && loadError && (
              <div className="history-error">{loadError}</div>
            )}

            {!loading && !loadError && (
              <>
                {/* ── Summary Stats ── */}
                {allRecords.length > 0 && (
                  <div className="history-stats">
                    <div className="history-stat-card">
                      <span className="history-stat-icon stat-total">
                        <FaHistory />
                      </span>
                      <div>
                        <h3>{stats.total}</h3>
                        <p>Total Records</p>
                      </div>
                    </div>
                    <div className="history-stat-card">
                      <span className="history-stat-icon stat-taken">
                        <FaCheckCircle />
                      </span>
                      <div>
                        <h3>{stats.taken}</h3>
                        <p>Taken</p>
                      </div>
                    </div>
                    <div className="history-stat-card">
                      <span className="history-stat-icon stat-missed">
                        <FaTimesCircle />
                      </span>
                      <div>
                        <h3>{stats.missed}</h3>
                        <p>Missed</p>
                      </div>
                    </div>
                    <div className="history-stat-card">
                      <span className="history-stat-icon stat-snoozed">
                        <FaClock />
                      </span>
                      <div>
                        <h3>{stats.snoozed}</h3>
                        <p>Snoozed</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Filters ── */}
                <div className="history-filters">
                  <div className="history-filter-field">
                    <label className="history-filter-label">
                      <FaCalendarAlt /> Date
                    </label>
                    <input
                      type="date"
                      className="history-filter-input"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>
                  <div className="history-filter-field">
                    <label className="history-filter-label">
                      <FaFilter /> Status
                    </label>
                    <select
                      className="history-filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="history-filter-field">
                    <label className="history-filter-label">
                      <FaPills /> Medicine
                    </label>
                    <select
                      className="history-filter-select"
                      value={medicineFilter}
                      onChange={(e) => setMedicineFilter(e.target.value)}
                    >
                      <option value="">All Medicines</option>
                      {medicineOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="history-filter-field">
                    <label className="history-filter-label">
                      <FaSearch /> Search
                    </label>
                    <div className="history-search-wrap">
                      <FaSearch className="history-search-icon" />
                      <input
                        type="text"
                        className="history-filter-input history-search-input"
                        placeholder="Search medicine..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  {hasFilters && (
                    <button
                      className="history-clear-btn"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* ── History Records ── */}
                {allRecords.length === 0 ? (
                  renderEmpty()
                ) : filteredRecords.length === 0 ? (
                  renderNoMatch()
                ) : (
                  <div className="history-list">
                    {filteredRecords.map((record) => (
                      <div className="history-card" key={record.id}>
                        <span className="history-med-icon">
                          <FaPills />
                        </span>
                        <div className="history-med-info">
                          <h3>{record.medicineName}</h3>
                          <p>
                            {record.dosage
                              ? `Dosage: ${record.dosage}`
                              : "Dosage: —"}
                          </p>
                        </div>
                        <div className="history-datetime">
                          <span className="history-datetime-item">
                            <FaCalendarAlt /> {formatDate(record.date)}
                          </span>
                          <span className="history-datetime-item">
                            <FaClock /> {formatTime12h(record.time)}
                          </span>
                        </div>
                        <span
                          className={`history-status history-status-${record.status.toLowerCase()}`}
                        >
                          {STATUS_ICONS[record.status]}
                          {record.statusLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default History;
