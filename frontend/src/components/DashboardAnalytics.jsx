import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { FaChartBar, FaChartLine, FaChartPie, FaArrowUp, FaArrowDown, FaMinus } from "react-icons/fa";
import "../styles/DashboardAnalytics.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DashboardAnalytics({ reminders = [] }) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const getDayIndex = (dateStr) => {
    return new Date(dateStr).getDay();
  };

  const getWeekNumber = (dateStr) => {
    const d = new Date(dateStr);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - startOfYear.getTime();
    return Math.ceil((diff / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
  };

  const weeklyReport = useMemo(() => {
    const currentWeek = getWeekNumber(today);
    const currentYear = now.getFullYear();
    const weekReminders = reminders.filter((r) => {
      const d = new Date(r.reminder_date);
      return getWeekNumber(r.reminder_date) === currentWeek && d.getFullYear() === currentYear;
    });
    return DAYS.map((day, idx) => {
      const dayReminders = weekReminders.filter((r) => getDayIndex(r.reminder_date) === idx);
      return {
        day,
        taken: dayReminders.filter((r) => r.status === "TAKEN").length,
        missed: dayReminders.filter((r) => r.status === "MISSED").length,
        pending: dayReminders.filter((r) => r.status === "PENDING").length,
      };
    });
  }, [reminders, today, now]);

  const monthlyReport = useMemo(() => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let monthIdx = currentMonth - i;
      let year = currentYear;
      if (monthIdx < 0) { monthIdx += 12; year -= 1; }
      const monthReminders = reminders.filter((r) => {
        const d = new Date(r.reminder_date);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      });
      const total = monthReminders.length;
      const taken = monthReminders.filter((r) => r.status === "TAKEN").length;
      months.push({
        month: MONTHS[monthIdx],
        adherence: total > 0 ? Math.round((taken / total) * 100) : 0,
        taken,
        missed: monthReminders.filter((r) => r.status === "MISSED").length,
      });
    }
    return months;
  }, [reminders, now]);

  const missedAnalysis = useMemo(() => {
    const missed = reminders.filter((r) => r.status === "MISSED");
    const getSlot = (timeStr) => {
      if (!timeStr) return "Other";
      const [h] = timeStr.split(":").map(Number);
      if (h >= 5 && h < 12) return "Morning";
      if (h >= 12 && h < 17) return "Afternoon";
      if (h >= 17 && h < 21) return "Evening";
      return "Night";
    };
    return ["Morning", "Afternoon", "Evening", "Night"].map((slot) => ({
      name: slot,
      value: missed.filter((r) => getSlot(r.reminder_time) === slot).length,
    }));
  }, [reminders]);

  const hasMissedData = missedAnalysis.some((d) => d.value > 0);

  const adherenceTrend = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayReminders = reminders.filter((r) => r.reminder_date === dateStr);
      const taken = dayReminders.filter((r) => r.status === "TAKEN").length;
      const total = dayReminders.length;
      data.push({
        label: DAYS[d.getDay()] + " " + d.getDate(),
        adherence: total > 0 ? Math.round((taken / total) * 100) : null,
      });
    }
    return data;
  }, [reminders, now]);

  const trendDirection = useMemo(() => {
    const valid = adherenceTrend.filter((d) => d.adherence !== null);
    if (valid.length < 2) return { direction: "stable", diff: 0 };
    const diff = valid[valid.length - 1].adherence - valid[0].adherence;
    if (diff > 5) return { direction: "up", diff };
    if (diff < -5) return { direction: "down", diff: Math.abs(diff) };
    return { direction: "stable", diff: 0 };
  }, [adherenceTrend]);

  const recentTrend = useMemo(() => {
    return adherenceTrend.filter((d) => d.adherence !== null).slice(-7);
  }, [adherenceTrend]);

  const weeklyAvg = useMemo(() => {
    const valid = weeklyReport.filter((d) => d.taken > 0 || d.missed > 0);
    if (valid.length === 0) return 0;
    const total = valid.reduce((s, d) => s + d.taken + d.missed, 0);
    const taken = valid.reduce((s, d) => s + d.taken, 0);
    return total > 0 ? Math.round((taken / total) * 100) : 0;
  }, [weeklyReport]);

  const PIE_COLORS_MISSED = ["#dc2626", "#f97316", "#eab308", "#94a3b8"];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="analytics-tooltip">
          <p className="analytics-tooltip-label">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="analytics-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const TrendIcon = trendDirection.direction === "up" ? FaArrowUp : trendDirection.direction === "down" ? FaArrowDown : FaMinus;

  return (
    <div className="analytics-section">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <div className="analytics-header-icon"><FaChartBar /></div>
          <div>
            <h2 className="analytics-title">Dashboard Analytics</h2>
            <p className="analytics-subtitle">Detailed insights into your medication patterns</p>
          </div>
        </div>
        <div className="analytics-header-stats">
          <div className="analytics-header-stat">
            <span className="ahs-label">Weekly Avg</span>
            <span className="ahs-value" style={{ color: weeklyAvg >= 75 ? "#16a34a" : weeklyAvg >= 50 ? "#d97706" : "#dc2626" }}>
              {weeklyAvg}%
            </span>
          </div>
          <div className="analytics-header-divider" />
          <div className="analytics-header-stat">
            <span className="ahs-label">Trend</span>
            <span className={"ahs-value trend-" + trendDirection.direction}>
              <TrendIcon /> {trendDirection.diff}%
            </span>
          </div>
        </div>
      </div>

      <div className="analytics-grid-2">
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title-group">
              <FaChartBar className="analytics-card-icon" />
              <h3>Weekly Medication Report</h3>
            </div>
            <span className="analytics-card-badge">This Week</span>
          </div>
          <div className="analytics-chart-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyReport} barGap={4} barCategoryGap={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                <Bar dataKey="taken" name="Taken" fill="#0F766E" radius={[6, 6, 0, 0]} animationDuration={1200} animationEasing="ease-out" />
                <Bar dataKey="missed" name="Missed" fill="#ef4444" radius={[6, 6, 0, 0]} animationDuration={1200} animationEasing="ease-out" />
                <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[6, 6, 0, 0]} animationDuration={1200} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title-group">
              <FaChartLine className="analytics-card-icon" />
              <h3>Monthly Medication Report</h3>
            </div>
            <span className="analytics-card-badge">Last 6 Months</span>
          </div>
          <div className="analytics-chart-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickFormatter={(v) => v + "%"} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="adherence" name="Adherence %" stroke="#0F766E" strokeWidth={3} dot={{ fill: "#0F766E", strokeWidth: 2, r: 5 }} activeDot={{ r: 7, fill: "#0F766E", stroke: "#fff", strokeWidth: 2 }} animationDuration={1500} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-grid-2">
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title-group">
              <FaChartPie className="analytics-card-icon" />
              <h3>Missed Dosage Analysis</h3>
            </div>
            <span className="analytics-card-badge">By Time Slot</span>
          </div>
          <div className="analytics-chart-wrapper">
            {hasMissedData ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={missedAnalysis} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" animationDuration={1200} animationEasing="ease-out">
                    {missedAnalysis.map((entry, idx) => (
                      <Cell key={"cell-" + idx} fill={PIE_COLORS_MISSED[idx % PIE_COLORS_MISSED.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-empty-chart">
                <FaChartPie style={{ fontSize: 48, color: "#cbd5e1", marginBottom: 12 }} />
                <p>No missed doses recorded yet.</p>
                <p style={{ fontSize: 13, color: "#94a3b8" }}>Keep up the good work! 🎉</p>
              </div>
            )}
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title-group">
              <FaChartLine className="analytics-card-icon" />
              <h3>Adherence Trend</h3>
            </div>
            <span className="analytics-card-badge">30-Day View</span>
          </div>
          <div className="analytics-chart-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={recentTrend}>
                <defs>
                  <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickFormatter={(v) => v + "%"} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="adherence" name="Adherence %" stroke="#0F766E" strokeWidth={2} fill="url(#adherenceGradient)" dot={{ fill: "#0F766E", strokeWidth: 1, r: 3 }} activeDot={{ r: 5, fill: "#0F766E", stroke: "#fff", strokeWidth: 2 }} animationDuration={1500} animationEasing="ease-out" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardAnalytics;
