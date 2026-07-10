import "../styles/Sidebar.css";

import {
  FaThLarge,
  FaPills,
  FaBell,
  FaChartBar,
  FaRobot,
  FaSignOutAlt,
} from "react-icons/fa";

import { GiMedicines } from "react-icons/gi";

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
          <FaPills />
          <span>Medicines</span>
        </li>

        <li>
          <FaBell />
          <span>Reminder</span>
        </li>

        <li>
          <FaChartBar />
          <span>Analytics</span>
        </li>

        <li>
          <FaRobot />
          <span>AI Assistant</span>
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