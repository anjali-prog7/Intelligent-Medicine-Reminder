import {
  FaPills,
  FaBell,
  FaBullseye,
  FaHeartbeat,
  FaExclamationTriangle,
} from "react-icons/fa";

import { BsCapsule } from "react-icons/bs";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import ProgressChart from "../components/ProgressChart";
import HealthScore from "../components/HealthScore";
import RecentActivity from "../components/RecentActivity";
import ReminderCard from "../components/ReminderCard";

function Dashboard() {
  return (
    <>
      <Sidebar />

      <div
        style={{
          marginLeft: "260px",
          minHeight: "100vh",
          background: "#F5F7FA",
        }}
      >
        <Navbar />

        <div className="dashboard">
          <div className="cardGrid">
            <StatCard
              icon={<FaPills />}
              title="TODAY'S MEDICINES"
              value="4"
              subtitle="2 remaining"
            />

            <StatCard
              icon={<FaBell />}
              title="NEXT REMINDER"
              value="8:00 PM"
              subtitle="Aspirin 100mg"
            />

            <StatCard
              icon={<FaBullseye />}
              title="ADHERENCE SCORE"
              value="94%"
              subtitle="Last 7 days"
            />

            <StatCard
              icon={<FaHeartbeat />}
              title="STOCK REMAINING"
              value="23"
              subtitle="Across 3 medicines"
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
        </div>
      </div>
    </>
  );
}

export default Dashboard;