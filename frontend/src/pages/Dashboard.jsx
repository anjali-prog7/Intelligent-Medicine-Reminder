import {
  FaPills,
  FaBell,
  FaBullseye,
  FaHeartbeat,
  FaExclamationTriangle,
  FaRobot,
  FaClock,
  FaSun,
  FaMoon,
  FaCalendarAlt,
  FaQuoteLeft,
  FaPhone,
  FaFlask,
  FaTint,
  FaPlusCircle,
  FaFileMedical,
  FaChartLine,
  FaCheckCircle,
  FaHourglass,
  FaUserMd,
  FaHospital,
  FaArrowRight,
  FaLightbulb,
  FaBrain,
  FaHeart,
  FaExclamationCircle,
  FaCloudSun,
} from "react-icons/fa";

import { BsCapsule } from "react-icons/bs";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import DashboardTopNav from "../components/DashboardTopNav";
import StatCard from "../components/StatCard";
import ProgressChart from "../components/ProgressChart";
import HealthScore from "../components/HealthScore";
import RecentActivity from "../components/RecentActivity";
import ReminderCard from "../components/ReminderCard";
import api from "../services/api";
import AdherenceTracker from "../components/AdherenceTracker";
import DashboardAnalytics from "../components/DashboardAnalytics";
import "../styles/Dashboard.css";
import "../styles/EnhancedDashboard.css";


function Dashboard() {
  const [medicines, setMedicines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [userData, setUserData] = useState({ username: "User", role: "Patient" });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ── Enhanced Dashboard State ──
  const [greeting, setGreeting] = useState("Good Morning ☀️");
  const [currentDate, setCurrentDate] = useState("");
  const [healthQuote, setHealthQuote] = useState("");
  const [countdown, setCountdown] = useState("--:--:--");
  const [waterGlasses, setWaterGlasses] = useState(0);

  const HEALTH_QUOTES = [
    "The greatest wealth is health. — Virgil",
    "A healthy outside starts from the inside. — Robert Urich",
    "Take care of your body. It's the only place you have to live. — Jim Rohn",
    "Health is not about the weight you lose, it's about the life you gain.",
    "Your health is an investment, not an expense.",
    "Wellness is the complete integration of body, mind, and spirit.",
    "The greatest medicine of all is to teach people how not to need it. — Hippocrates",
    "The doctor of the future will give no medicine but will interest his patients in diet. — Thomas Edison",
  ];

  // Set greeting and date
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting("Good Morning ☀️");
    else if (hour < 17) setGreeting("Good Afternoon 🌤️");
    else if (hour < 21) setGreeting("Good Evening 🌅");
    else setGreeting("Good Night 🌙");

    setCurrentDate(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
    setHealthQuote(
      HEALTH_QUOTES[Math.floor(Math.random() * HEALTH_QUOTES.length)]
    );
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [medRes, remRes, profileRes] = await Promise.all([
          api.get("medicines/"),
          api.get("reminders/"),
          api.get("accounts/profile/").catch(() => null),
        ]);
        setMedicines(medRes.data);
        setReminders(remRes.data);
        if (profileRes?.data) {
          setUserData({
            username: profileRes.data.username || "User",
            role: profileRes.data.role || "Patient",
          });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        const saved = JSON.parse(localStorage.getItem("medicines")) || [];
        setMedicines(saved);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalMedicines = medicines.length;

  const activeMedicines = medicines.filter(
    (item) => item.is_active === true
  ).length;

  const pendingMedicines = medicines.filter(
    (item) => item.is_active === false
  ).length;

  const nextMedicine =
    medicines.find((item) => item.frequency === "Morning") ||
    medicines.find((item) => item.frequency === "Afternoon") ||
    medicines.find((item) => item.frequency === "Night");


  const morningCount = medicines.filter(
    (item) => item.frequency === "Morning"
  ).length;

  const afternoonCount = medicines.filter(
    (item) => item.frequency === "Afternoon"
  ).length;

  const nightCount = medicines.filter(
    (item) => item.frequency === "Night"
  ).length;

  const pendingReminders = reminders.filter(
    (item) => item.status === "PENDING"
  ).length;

  const takenReminders = reminders.filter(
    (item) => item.status === "TAKEN"
  ).length;

  const adherenceScore = reminders.length > 0
    ? Math.round((takenReminders / reminders.length) * 100)
    : 0;

  // ── Next pending reminder for countdown ──
  const nextReminder = reminders.find((r) => r.status === "PENDING") || null;

  // ── Countdown timer effect ──
  useEffect(() => {
    if (!nextReminder || !nextReminder.reminder_time) {
      setCountdown("--:--:--");
      return;
    }
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

  // ── Get medicine name by ID ──
  const getMedicineName = useCallback(
    (medicineId) => {
      const med = medicines.find((m) => m.id === medicineId);
      return med ? med.medicine_name : `Medicine #${medicineId}`;
    },
    [medicines]
  );

  // ── Schedule timeline slots ──
  const scheduleSlots = [
    { key: "morning", label: "Morning", time: "6:00 AM - 9:00 AM", icon: <FaSun /> },
    { key: "afternoon", label: "Afternoon", time: "12:00 PM - 2:00 PM", icon: <FaClock /> },
    { key: "evening", label: "Evening", time: "4:00 PM - 6:00 PM", icon: <FaCloudSun /> },
    { key: "night", label: "Night", time: "8:00 PM - 10:00 PM", icon: <FaMoon /> },
  ];

  const getSlotMeds = (slotKey) => {
    const freqMap = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
    return medicines.filter(
      (m) => (m.frequency || "").toLowerCase() === slotKey
    );
  };

  // ── Weekly adherence data (stable, only recomputed when adherenceScore changes) ──
  const weeklyData = useMemo(() => {
    const seed = adherenceScore;
    return [
      { day: "Mon", value: Math.min(Math.max(seed - 10 + 8, 0), 100) },
      { day: "Tue", value: Math.min(Math.max(seed - 5 + 6, 0), 100) },
      { day: "Wed", value: Math.min(Math.max(seed + 3, 0), 100) },
      { day: "Thu", value: Math.min(Math.max(seed + 5, 0), 100) },
      { day: "Fri", value: Math.min(Math.max(seed + 7, 0), 100) },
      { day: "Sat", value: Math.min(Math.max(seed + 6, 0), 100) },
      { day: "Sun", value: Math.min(Math.max(seed + 4, 0), 100) },
    ];
  }, [adherenceScore]);
  const weeklyAvg = Math.round(
    weeklyData.reduce((sum, d) => sum + d.value, 0) / weeklyData.length
  );

  // ── AI Health Insights ──
  const getHealthInsight = () => {
    if (adherenceScore >= 90)
      return {
        grade: "Excellent!",
        badge: "excellent",
        message:
          "You're doing fantastic! Your medication adherence is outstanding. Keep up this great habit - your consistency is building a strong foundation for your health. 🌟",
      };
    if (adherenceScore >= 70)
      return {
        grade: "Good",
        badge: "good",
        message:
          "You're on the right track! Try to stay consistent with your medication schedule. Setting alarms or using our reminder system can help improve your adherence even more. 💪",
      };
    if (adherenceScore >= 50)
      return {
        grade: "Fair",
        badge: "fair",
        message:
          "There's room for improvement, and that's okay! We recommend using the reminder system and setting up notifications to help you stay on track with your medications. You've got this! 💡",
      };
    return {
      grade: "Needs Attention",
      badge: "poor",
      message:
        "Your adherence is low. Please consult with your healthcare provider. Setting up regular reminders and organizing your medications can make a big difference. We're here to help! 🤝",
    };
  };
  const insight = getHealthInsight();

  // ── Refill alerts (TODO: replace with real API data) ──
  const refillAlerts = medicines
    .filter((m) => m.stock !== undefined && m.stock <= 5)
    .map((m) => ({
      name: m.medicine_name || "Unknown",
      dosage: m.dosage || "—",
      stock: m.stock || 0,
      expiry: "Soon",
    }));

  // ── Recent activities from reminders data ──
  const recentActivities = reminders.slice(0, 5).map((r) => ({
    action: r.status === "TAKEN" ? "Taken" : r.status === "MISSED" ? "Missed" : "Pending",
    medicine: getMedicineName(r.medicine),
    time: r.reminder_time
      ? new Date(`2000-01-01T${r.reminder_time}`).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--",
  }));


  return (
    <div className="dashboard-layout">

      {/* SIDEBAR FIXED */}
      <Sidebar />

      {/* MAIN AREA */}
      <div className="dashboard-content-wrapper">

        {/* PROFESSIONAL TOP NAVBAR */}
        <DashboardTopNav
          userData={userData}
          medicines={medicines}
          reminders={reminders}
        />

        {/* CONTENT */}
        <div className="dashboard-content">

          <div className="dashboard">

            {/* ── WELCOME SECTION ── */}
            <div className="welcome-section">
              <div className="welcome-left">
                <span className="welcome-greeting">{greeting}</span>
                <h1 className="welcome-title">
                  Welcome back, <span className="highlight-name">{userData.username || "User"}</span>
                </h1>
                <span className="welcome-date">
                  <FaCalendarAlt /> {currentDate}
                </span>
              </div>
              <div className="welcome-quote">
                <FaQuoteLeft className="quote-icon" />
                <span>{healthQuote}</span>
              </div>
            </div>

            <div className="cardGrid">

              <StatCard
                icon={<FaPills />}
                title="TOTAL MEDICINES"
                value={totalMedicines}
                subtitle={`${activeMedicines} Active | ${pendingMedicines} Pending`}
              />

              <StatCard
                icon={<FaBell />}
                title="NEXT REMINDER"
                value={nextMedicine ? nextMedicine.frequency : "No Reminder"}
                subtitle={`M:${morningCount} A:${afternoonCount} N:${nightCount}`}
              />

              <StatCard
                icon={<FaBullseye />}
                title="ADHERENCE SCORE"
                value={`${adherenceScore}%`}
                subtitle={`${takenReminders} of ${reminders.length} reminders taken`}
              />

              <StatCard
                icon={<FaHeartbeat />}
                title="ACTIVE MEDICINES"
                value={activeMedicines}
                subtitle={`Out of ${totalMedicines} Medicines`}
              />

              <StatCard
                icon={<FaExclamationTriangle />}
                title="UPCOMING REFILLS"
                value="2"
                subtitle="Within 7 days"
              />

              <StatCard
                icon={<BsCapsule />}
                title="AI HEALTH SCORE"
                value="87"
                subtitle="Excellent"
              />

            </div>

            <div className="chartSection">
              <ProgressChart />
              <HealthScore />
            </div>

            <div className="bottomGrid">
              <RecentActivity />
              <ReminderCard />
            </div>


            {/* ════════════════════════════════════════════ */}
            {/*  ENHANCED DASHBOARD SECTIONS              */}
            {/* ════════════════════════════════════════════ */}

            {/* ── ROW 1: Upcoming Reminder + Today's Schedule (2 cols) ── */}
            <div className="enhanced-section enhanced-grid-2">

              {/* Upcoming Reminder with Countdown */}
              <div className="enhanced-card reminder-countdown-card stagger-1">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaClock /></div>
                    <h3>Upcoming Reminder</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#e4f7f5", color: "#0F766E" }}>
                    Next Dose
                  </span>
                </div>
                {nextReminder ? (
                  <div className="countdown-display">
                    <p className="medicine-name">{getMedicineName(nextReminder.medicine)}</p>
                    <p className="dosage-info">
                      {medicines.find((m) => m.id === nextReminder.medicine)?.dosage || "—"}
                      {' · '}
                      {nextReminder.reminder_time?.substring(0, 5) || "--:--"}
                    </p>
                    <div className="countdown-timer">
                      <div className="time-block">
                        <span className="time-value">{countdown.substring(0, 2)}</span>
                        <span className="time-label">Hours</span>
                      </div>
                      <span className="time-separator">:</span>
                      <div className="time-block">
                        <span className="time-value">{countdown.substring(3, 5)}</span>
                        <span className="time-label">Min</span>
                      </div>
                      <span className="time-separator">:</span>
                      <div className="time-block">
                        <span className="time-value">{countdown.substring(6, 8)}</span>
                        <span className="time-label">Sec</span>
                      </div>
                    </div>
                    <p className="countdown-time-label">time remaining</p>
                    <button
                      className="take-now-btn"
                      onClick={() => {
                        /* TODO: Mark reminder as taken via API */
                        alert(`Time to take ${getMedicineName(nextReminder.medicine)}!`);
                      }}
                    >
                      <FaCheckCircle /> Take Now
                    </button>
                  </div>
                ) : (
                  <div className="no-reminder-msg">
                    <FaBell style={{ fontSize: "36px", opacity: 0.3, display: "block", margin: "0 auto 10px" }} />
                    <p>No pending reminders 🎉</p>
                  </div>
                )}
              </div>

              {/* Today's Schedule Timeline */}
              <div className="enhanced-card schedule-timeline-card stagger-2">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaClock /></div>
                    <h3>Today's Schedule</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#fff3e0", color: "#e67e22" }}>
                    {medicines.length} meds
                  </span>
                </div>
                <div className="schedule-timeline">
                  {scheduleSlots.map((slot) => {
                    const slotMeds = getSlotMeds(slot.key);
                    return (
                      <div key={slot.key} className={`schedule-slot ${slot.key}`}>
                        <div className="schedule-time-icon">{slot.icon}</div>
                        <div className="schedule-slot-info">
                          <p className="slot-label">{slot.label}</p>
                          <p className="slot-time">{slot.time}</p>
                          <div className="slot-meds">
                            {slotMeds.length > 0 ? (
                              slotMeds.map((med) => (
                                <span key={med.id} className="schedule-med-tag">
                                  <FaPills style={{ fontSize: 10 }} /> {med.medicine_name}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>No medicines scheduled</span>
                            )}
                          </div>
                        </div>
                        <span className="schedule-count">{slotMeds.length}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── ROW 2: AI Insights + AI Assistant Quick Card (2 cols) ── */}
            <div className="enhanced-section enhanced-grid-2">

              {/* AI Health Insights */}
              <div className="enhanced-card ai-insights-card stagger-3">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaBrain /></div>
                    <h3>AI Health Insights</h3>
                  </div>
                  <span className={`ai-insight-badge ${insight.badge}`}>
                    <FaHeart /> {insight.grade}
                  </span>
                </div>
                <div className="ai-insight-content">
                  <div className="ai-insight-message">
                    <FaLightbulb style={{ color: "#d97706", marginRight: 8 }} />
                    {insight.message}
                  </div>
                  <div className="ai-insight-stats">
                    <div className="ai-insight-stat">
                      <span className="stat-number">{adherenceScore}%</span>
                      <span className="stat-label">Adherence</span>
                    </div>
                    <div className="ai-insight-stat">
                      <span className="stat-number">{takenReminders}</span>
                      <span className="stat-label">Taken</span>
                    </div>
                    <div className="ai-insight-stat">
                      <span className="stat-number">{pendingReminders}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Assistant Quick Card */}
              <div className="enhanced-card ai-assistant-quick-card stagger-4">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaRobot /></div>
                    <h3>AI Assistant</h3>
                  </div>
                  <span className="card-badge">Online</span>
                </div>
                <div className="ai-quick-content">
                  <p>
                    Need help with your medications? Ask our AI assistant about
                    medicine info, drug interactions, health tips, and more!
                  </p>
                  <button
                    className="open-ai-btn"
                    onClick={() => navigate("/aiassistant")}
                  >
                    <FaRobot /> Open AI Assistant <FaArrowRight />
                  </button>
                </div>
              </div>
            </div>

            {/* ── ROW 3: Quick Action Buttons (full width) ── */}
            <div className="enhanced-section">
              <div className="enhanced-card quick-actions-card stagger-5">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaPlusCircle /></div>
                    <h3>Quick Actions</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                    {medicines.length + reminders.length} total
                  </span>
                </div>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => navigate("/medicines")}>
                    <FaPills className="action-icon" />
                    <span className="action-label">Add Medicine</span>
                    <span className="action-sub">Add new medication</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate("/reminders")}>
                    <FaBell className="action-icon" />
                    <span className="action-label">Add Reminder</span>
                    <span className="action-sub">Set medication alarm</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate("/medicines")}>
                    <FaFileMedical className="action-icon" />
                    <span className="action-label">Scan Prescription</span>
                    <span className="action-sub">Upload & scan</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate("/reminders")}>
                    <FaChartLine className="action-icon" />
                    <span className="action-label">Generate Report</span>
                    <span className="action-sub">Export medication data</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── ROW 4: Refill Alert + Water Reminder + Weekly Progress (3 cols) ── */}
            <div className="enhanced-section enhanced-grid-3">

              {/* Refill Alert Card */}
              <div className="enhanced-card refill-alert-card stagger-6">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaExclamationTriangle /></div>
                    <h3>Refill Alerts</h3>
                  </div>
                  <span className="card-badge">{refillAlerts.length} low</span>
                </div>
                {refillAlerts.length > 0 ? (
                  refillAlerts.map((item, idx) => (
                    <div key={idx} className="refill-item">
                      <div className="refill-item-icon">
                        <FaFlask />
                      </div>
                      <div className="refill-item-info">
                        <p className="refill-name">{item.name}</p>
                        <p className="refill-detail">{item.dosage} · Expires {item.expiry}</p>
                      </div>
                      <span className="refill-stock">{item.stock} left</span>
                    </div>
                  ))
                ) : (
                  <div className="no-refills">
                    <FaCheckCircle style={{ color: "#16a34a", fontSize: 24, marginBottom: 8 }} />
                    <p>All medicines are well-stocked ✓</p>
                  </div>
                )}
              </div>

              {/* Daily Water Reminder Card */}
              <div className="enhanced-card water-reminder-card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaTint /></div>
                    <h3>Water Reminder</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#dbeafe", color: "#1e40af" }}>
                    {waterGlasses}/8
                  </span>
                </div>
                <div className="water-tracker">
                  <div className="water-stats">
                    <div className="water-glasses">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className={`water-glass ${i < waterGlasses ? "filled" : ""}`}
                          onClick={() => setWaterGlasses(i < waterGlasses ? i : i + 1)}
                          title={i < waterGlasses ? "Filled" : "Click to fill"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="water-progress-text">
                    <strong>{waterGlasses * 250}ml</strong> of <strong>2000ml</strong> consumed
                  </p>
                  <button
                    className="water-add-btn"
                    onClick={() => setWaterGlasses(Math.min(waterGlasses + 1, 8))}
                    disabled={waterGlasses >= 8}
                  >
                    <FaTint style={{ marginRight: 6 }} /> Add Glass
                  </button>
                </div>
              </div>

              {/* Weekly Progress */}
              <div className="enhanced-card weekly-progress-card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaChartLine /></div>
                    <h3>Weekly Progress</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#f0fdfa", color: "#0F766E" }}>
                    Avg {weeklyAvg}%
                  </span>
                </div>
                <div className="weekly-bars">
                  {weeklyData.map((d) => (
                    <div key={d.day} className="weekly-bar-wrapper">
                      <span className="weekly-bar-value">{d.value}%</span>
                      <div
                        className="weekly-bar"
                        style={{ height: `${Math.max(d.value, 4)}%` }}
                        title={`${d.day}: ${d.value}%`}
                      />
                      <span className="weekly-bar-label">{d.day}</span>
                    </div>
                  ))}
                </div>
                <div className="weekly-avg">
                  <span className="avg-label">
                    <FaHeart style={{ color: "#0F766E", marginRight: 6 }} />
                    This week's average adherence
                  </span>
                  <span className="avg-value">{weeklyAvg}%</span>
                </div>
              </div>
            </div>

            {/* ── ROW 5: Emergency Contact Card + Recent Activity timeline extended ── */}
            <div className="enhanced-section enhanced-grid-2">

              {/* Emergency Contact Card */}
              <div className="enhanced-card emergency-card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon"><FaPhone /></div>
                    <h3>Emergency Contacts</h3>
                  </div>
                  <span className="card-badge">Emergency</span>
                </div>
                <div className="emergency-contact">
                  {/* TODO: Replace with real user data from backend */}
                  <div className="emergency-contact-item emergency">
                    <div className="emergency-contact-icon"><FaPhone /></div>
                    <div className="emergency-contact-info">
                      <p className="contact-name">Emergency Services</p>
                      <p className="contact-phone">📞 911</p>
                    </div>
                    <a href="tel:911" className="emergency-call-btn" title="Call now">
                      <FaPhone />
                    </a>
                  </div>
                  <div className="emergency-contact-item doctor">
                    <div className="emergency-contact-icon"><FaUserMd /></div>
                    <div className="emergency-contact-info">
                      <p className="contact-name">Dr. Sharma</p>
                      <p className="contact-phone">📞 +1 (555) 123-4567</p>
                    </div>
                    <a href="tel:+15551234567" className="emergency-call-btn" title="Call doctor"
                       style={{ background: "#2563eb" }}>
                      <FaPhone />
                    </a>
                  </div>
                  <div className="emergency-contact-item hospital">
                    <div className="emergency-contact-icon"><FaHospital /></div>
                    <div className="emergency-contact-info">
                      <p className="contact-name">City Hospital</p>
                      <p className="contact-phone">📍 123 Health St · +1 (555) 987-6543</p>
                    </div>
                    <a href="tel:+15559876543" className="emergency-call-btn" title="Call hospital"
                       style={{ background: "#d97706" }}>
                      <FaPhone />
                    </a>
                  </div>
                </div>
              </div>

              {/* Recent Activity with enhanced data */}
              <div className="enhanced-card" style={{ background: "#fff" }}>
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-header-icon" style={{ background: "#f0fdfa", color: "#0F766E" }}>
                      <FaClock />
                    </div>
                    <h3>Recent Activity</h3>
                  </div>
                  <span className="card-badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                    Last 24h
                  </span>
                </div>
                {recentActivities.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recentActivities.map((act, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: idx % 2 === 0 ? "#f8fafc" : "#fff",
                          transition: "all 0.2s",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            flexShrink: 0,
                            background:
                              act.action === "Taken"
                                ? "#d1fae5"
                                : act.action === "Missed"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              act.action === "Taken"
                                ? "#065f46"
                                : act.action === "Missed"
                                ? "#991b1b"
                                : "#92400e",
                          }}
                        >
                          {act.action === "Taken" ? (
                            <FaCheckCircle />
                          ) : act.action === "Missed" ? (
                            <FaExclamationCircle />
                          ) : (
                            <FaHourglass />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                            {act.medicine}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                            {act.action} · {act.time}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: 10,
                            background:
                              act.action === "Taken"
                                ? "#d1fae5"
                                : act.action === "Missed"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              act.action === "Taken"
                                ? "#065f46"
                                : act.action === "Missed"
                                ? "#991b1b"
                                : "#92400e",
                          }}
                        >
                          {act.action}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-reminder-msg">
                    <FaClock style={{ fontSize: 32, opacity: 0.3 }} />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════ */}
            {/*  FEATURE 1: MEDICATION ADHERENCE TRACKING  */}
            {/* ════════════════════════════════════════════ */}
            <AdherenceTracker
              reminders={reminders}
              medicines={medicines}
            />

            {/* ════════════════════════════════════════════ */}
            {/*  FEATURE 2: DASHBOARD ANALYTICS            */}
            {/* ════════════════════════════════════════════ */}
            <DashboardAnalytics
              reminders={reminders}
              medicines={medicines}
            />

          </div>

        </div>

      </div>

    </div>
  );
}


export default Dashboard;