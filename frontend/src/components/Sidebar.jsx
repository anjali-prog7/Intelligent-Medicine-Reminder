import "../styles/Sidebar.css";

import {
  FaThLarge,
  FaPills,
  FaChartBar,
  FaFileMedical,
  FaHistory,
  FaCog,
  FaSignOutAlt,
  FaSyncAlt,
} from "react-icons/fa";

import { HiDocumentReport } from "react-icons/hi";

function Sidebar() {
  return (
    <div className="sidebar">

      {/* Menu */}

      <ul className="menu">

        <li className="active">
          <FaThLarge />
          <span>Dashboard</span>
        </li>

        <li>
  <FaSyncAlt />
  <span>Refill Tracker</span>
</li>

        <li>
  <FaChartBar />
  <span>Analytics</span>
</li>

        <li>
          <FaFileMedical />
          <span>Prescription OCR</span>
        </li>

        <li>
          <HiDocumentReport />
          <span>Reports</span>
        </li>

        <li>
          <FaHistory />
          <span>History</span>
        </li>

        <li>
          <FaCog />
          <span>Settings</span>
        </li>

      </ul>

      {/* Logout */}

      <div className="logout">
        <FaSignOutAlt />
        <span>Logout</span>
      </div>

    </div>
  );
}

export default Sidebar;