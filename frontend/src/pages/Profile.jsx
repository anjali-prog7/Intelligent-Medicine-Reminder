import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import DashboardTopNav from "../components/DashboardTopNav";
import api from "../services/api";
import "../styles/Profile.css";

import {
  FaPills,
  FaBell,
  FaCalendarCheck,
  FaCheckCircle,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaVenusMars,
  FaBirthdayCake,
  FaShieldAlt,
  FaCalendarAlt,
  FaClock,
  FaEdit,
  FaKey,
  FaFileDownload,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaIdBadge,
  FaCheckDouble,
  FaUserCircle,
  FaInfoCircle,
  FaUserTag,
  FaHashtag,
} from "react-icons/fa";

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const [profileRes, medRes, remRes] = await Promise.all([
          api.get("accounts/profile/"),
          api.get("medicines/").catch(() => ({ data: [] })),
          api.get("reminders/").catch(() => ({ data: [] })),
        ]);
        setProfile(profileRes.data);
        setMedicines(medRes.data || []);
        setReminders(remRes.data || []);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Could not load profile data. Please try again.");
        if (err.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/login");
  };

  // ── Computed Stats ──
  const totalMedicines = medicines.length;
  const activeReminders = reminders.filter(
    (r) => r.status === "PENDING" || r.status === "Pending"
  ).length;
  const todayReminders = reminders.filter((r) => {
    if (!r.reminder_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return r.reminder_date === today;
  }).length;
  const completedDoses = reminders.filter(
    (r) => r.status === "TAKEN" || r.status === "Taken"
  ).length;

  // ── Helpers ──
  const getInitial = (name) => (name || "U")[0].toUpperCase();

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isAvailable = (value) => {
    return value && value !== "" && value !== "None" && value !== "null";
  };

  // ── Skeleton Loading ──
  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-content-wrapper">
          <DashboardTopNav userData={{ username: "User", role: "Patient" }} />
          <div className="dashboard-content">
            <div className="profile-page">
              <div className="profile-skeleton">
                <div className="skeleton-row">
                  <div className="skeleton-avatar" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line skeleton-line-md" />
                    <div className="skeleton-line-sm" />
                    <div className="skeleton-line skeleton-line-md" style={{ width: "50%" }} />
                  </div>
                </div>
              </div>
              <div className="profile-stats-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="profile-stat-card" style={{ opacity: 1, animation: "none" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e2e8f0", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-line" style={{ width: "40%", marginBottom: 6 }} />
                      <div className="skeleton-line-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !profile) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-content-wrapper">
          <DashboardTopNav userData={{ username: "User", role: "Patient" }} />
          <div className="dashboard-content">
            <div className="profile-page">
              <div className="profile-error">
                <div className="profile-error-icon">
                  <FaExclamationTriangle />
                </div>
                <h2 className="profile-error-title">Oops! Something went wrong</h2>
                <p className="profile-error-message">{error}</p>
                <button
                  className="profile-error-retry-btn"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── User Data ──
  const userName = profile?.full_name || profile?.username || "User";
  const username = profile?.username || "—";
  const email = profile?.email || "—";
  const role = profile?.role || "Patient";
  const joinedDate = formatDate(profile?.date_joined || profile?.created_at);
  const phone = profile?.phone || profile?.phone_number;
  const gender = profile?.gender;
  const dateOfBirth = formatDate(profile?.date_of_birth || profile?.dob);
  const lastLogin = formatDate(profile?.last_login);
  const isVerified = profile?.is_verified !== undefined ? profile.is_verified : true;
  const isActive = profile?.is_active !== undefined ? profile.is_active : true;
  const accountType = role;

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="dashboard-content-wrapper">
        <DashboardTopNav
          userData={{
            username: profile?.username || "User",
            role: profile?.role || "Patient",
          }}
          medicines={medicines}
          reminders={reminders}
        />

        <div className="dashboard-content">
          <div className="profile-page">
            {/* ════════════════════════════════════════════
                PROFILE HEADER CARD
                ════════════════════════════════════════════ */}
            <div className="profile-header-card">
              {/* Avatar */}
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar">
                  {getInitial(userName)}
                </div>
                <div className="profile-online-indicator" title="Online" />
              </div>

              {/* Info */}
              <div className="profile-header-info">
                <h1 className="profile-header-name">{userName}</h1>
                <p className="profile-header-username">@{username}</p>

                <div className="profile-header-details">
                  <div className="profile-header-detail-item">
                    <FaEnvelope className="detail-icon" />
                    {email}
                  </div>

                  {isAvailable(phone) && (
                    <div className="profile-header-detail-item">
                      <FaPhone className="detail-icon" />
                      {phone}
                    </div>
                  )}

                  {joinedDate && (
                    <div className="profile-header-detail-item">
                      <FaCalendarAlt className="detail-icon" />
                      Joined {joinedDate}
                    </div>
                  )}
                </div>

                {/* Role Badge */}
                <div className="profile-role-badge">
                  <FaIdBadge />
                  {role}
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════
                STATISTICS SECTION
                ════════════════════════════════════════════ */}
            <div className="profile-stats-grid">
              {/* Total Medicines */}
              <div className="profile-stat-card">
                <div className="profile-stat-icon teal">
                  <FaPills />
                </div>
                <div className="profile-stat-info">
                  <div className="profile-stat-number">{totalMedicines}</div>
                  <div className="profile-stat-label">Total Medicines</div>
                </div>
              </div>

              {/* Active Reminders */}
              <div className="profile-stat-card">
                <div className="profile-stat-icon blue">
                  <FaBell />
                </div>
                <div className="profile-stat-info">
                  <div className="profile-stat-number">{activeReminders}</div>
                  <div className="profile-stat-label">Active Reminders</div>
                </div>
              </div>

              {/* Today's Medicines */}
              <div className="profile-stat-card">
                <div className="profile-stat-icon amber">
                  <FaCalendarCheck />
                </div>
                <div className="profile-stat-info">
                  <div className="profile-stat-number">{todayReminders}</div>
                  <div className="profile-stat-label">Today's Medicines</div>
                </div>
              </div>

              {/* Completed Doses */}
              <div className="profile-stat-card">
                <div className="profile-stat-icon green">
                  <FaCheckCircle />
                </div>
                <div className="profile-stat-info">
                  <div className="profile-stat-number">{completedDoses}</div>
                  <div className="profile-stat-label">Completed Doses</div>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════
                PERSONAL & ACCOUNT INFORMATION
                ════════════════════════════════════════════ */}
            <div className="profile-content-grid">
              {/* Personal Information Card */}
              <div className="profile-info-card">
                <div className="profile-info-card-header">
                  <div className="profile-info-card-header-icon teal-bg">
                    <FaUserCircle />
                  </div>
                  <h3 className="profile-info-card-title">Personal Information</h3>
                </div>

                <div className="profile-info-fields">
                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaUser /> Full Name
                    </span>
                    <span className="profile-info-field-value">
                      {isAvailable(profile?.full_name) ? (
                        <><FaCheckDouble className="field-value-icon" />{profile.full_name}</>
                      ) : (
                        <span className="not-available">Not Available</span>
                      )}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaHashtag /> Username
                    </span>
                    <span className="profile-info-field-value">
                      {username}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaEnvelope /> Email
                    </span>
                    <span className="profile-info-field-value">
                      {email}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaPhone /> Phone
                    </span>
                    <span className={`profile-info-field-value ${!isAvailable(phone) ? "not-available" : ""}`}>
                      {isAvailable(phone) ? (
                        <><FaPhone className="field-value-icon" />{phone}</>
                      ) : (
                        "Not Available"
                      )}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaVenusMars /> Gender
                    </span>
                    <span className={`profile-info-field-value ${!isAvailable(gender) ? "not-available" : ""}`}>
                      {isAvailable(gender) ? gender : "Not Available"}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaBirthdayCake /> Date of Birth
                    </span>
                    <span className={`profile-info-field-value ${!isAvailable(dateOfBirth) ? "not-available" : ""}`}>
                      {isAvailable(dateOfBirth) ? (
                        <><FaBirthdayCake className="field-value-icon" />{dateOfBirth}</>
                      ) : (
                        "Not Available"
                      )}
                    </span>
                  </div>

                  <div className="profile-info-field">
                    <span className="profile-info-field-label">
                      <FaUserTag /> Role
                    </span>
                    <span className="profile-info-field-value">
                      {role}
                    </span>
                  </div>

                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaShieldAlt /> Account Status
                    </span>
                    <span className="profile-info-field-value">
                      <span className={`profile-status-badge ${isActive ? "active" : "inactive"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Information Card */}
              <div className="profile-info-card">
                <div className="profile-info-card-header">
                  <div className="profile-info-card-header-icon blue-bg">
                    <FaInfoCircle />
                  </div>
                  <h3 className="profile-info-card-title">Account Information</h3>
                </div>

                <div className="profile-info-fields">
                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaUserTag /> Account Type
                    </span>
                    <span className="profile-info-field-value">
                      {accountType}
                    </span>
                  </div>

                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaShieldAlt /> Verification Status
                    </span>
                    <span className="profile-info-field-value">
                      <span className={`profile-status-badge ${isVerified ? "verified" : "unverified"}`}>
                        {isVerified ? "Verified" : "Unverified"}
                      </span>
                    </span>
                  </div>

                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaCalendarAlt /> Member Since
                    </span>
                    <span className="profile-info-field-value">
                      {joinedDate ? (
                        <><FaCalendarAlt className="field-value-icon" />{joinedDate}</>
                      ) : (
                        <span className="not-available">Not Available</span>
                      )}
                    </span>
                  </div>

                  <div className="profile-info-field full-width">
                    <span className="profile-info-field-label">
                      <FaClock /> Last Login
                    </span>
                    <span className={`profile-info-field-value ${!isAvailable(lastLogin) ? "not-available" : ""}`}>
                      {isAvailable(lastLogin) ? (
                        <><FaClock className="field-value-icon" />{lastLogin}</>
                      ) : (
                        "Not Available"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════
                ACTION BUTTONS
                ════════════════════════════════════════════ */}
            <div className="profile-actions-section">
              <h3 className="profile-actions-title">
                <FaEdit /> Quick Actions
              </h3>
              <div className="profile-actions-grid">
                {/* Edit Profile */}
                <button
                  className="profile-action-btn edit"
                  onClick={() => alert("Edit Profile feature coming soon!")}
                  aria-label="Edit Profile"
                >
                  <div className="action-btn-icon">
                    <FaEdit />
                  </div>
                  <span className="action-btn-label">Edit Profile</span>
                  <span className="action-btn-sub">Update your details</span>
                </button>

                {/* Change Password */}
                <button
                  className="profile-action-btn password"
                  onClick={() => alert("Change Password feature coming soon!")}
                  aria-label="Change Password"
                >
                  <div className="action-btn-icon">
                    <FaKey />
                  </div>
                  <span className="action-btn-label">Change Password</span>
                  <span className="action-btn-sub">Update security</span>
                </button>

                {/* Download Health Report */}
                <button
                  className="profile-action-btn report"
                  onClick={() => alert("Health Report download coming soon!")}
                  aria-label="Download Health Report"
                >
                  <div className="action-btn-icon">
                    <FaFileDownload />
                  </div>
                  <span className="action-btn-label">Health Report</span>
                  <span className="action-btn-sub">Download PDF</span>
                </button>

                {/* Logout */}
                <button
                  className="profile-action-btn logout-action"
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <div className="action-btn-icon">
                    <FaSignOutAlt />
                  </div>
                  <span className="action-btn-label">Logout</span>
                  <span className="action-btn-sub">Sign out safely</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
