import {
  FaPills,
  FaBell,
  FaBullseye,
  FaHeartbeat,
  FaExclamationTriangle,
} from "react-icons/fa";

import { BsCapsule } from "react-icons/bs";

import { useState, useEffect } from "react";

import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
import ProgressChart from "../components/ProgressChart";
import HealthScore from "../components/HealthScore";
import RecentActivity from "../components/RecentActivity";
import ReminderCard from "../components/ReminderCard";


function Dashboard() {
  const [medicines, setMedicines] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("medicines")) || [];
    setMedicines(saved);
  }, []);

  const totalMedicines = medicines.length;

  const activeMedicines = medicines.filter(
    (item) => item.status === "Active"
  ).length;

  const pendingMedicines = medicines.filter(
    (item) => item.status === "Pending"
  ).length;

  const nextMedicine =
    medicines.find((item) => item.schedule === "Morning") ||
    medicines.find((item) => item.schedule === "Afternoon") ||
    medicines.find((item) => item.schedule === "Night");


  const morningCount = medicines.filter(
    (item) => item.schedule === "Morning"
  ).length;

  const afternoonCount = medicines.filter(
    (item) => item.schedule === "Afternoon"
  ).length;

  const nightCount = medicines.filter(
    (item) => item.schedule === "Night"
  ).length;


  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F5F7FA"
      }}
    >


      {/* SIDEBAR FIXED */}
      <Sidebar />


      {/* MAIN AREA */}

      <div
        style={{
          marginLeft: "260px",
          width: "calc(100% - 260px)",
        }}
      >




        {/* TOP NAVBAR */}

        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "90px",
            background: "#145f58",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            zIndex: 2000,
            boxShadow: "0 3px 10px rgba(0,0,0,0.15)"
          }}
        >


          {/* LOGO LEFT */}

          <div
            style={{
              color: "white",
              fontSize: "28px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            💊 PillSync
          </div>



          {/* SEARCH CENTER */}

          <input
            type="text"
            placeholder="Search medicines..."
            style={{
              width: "450px",
              height: "45px",
              background: "#fff",
              border: "none",
              borderRadius: "25px",
              padding: "0 25px",
              fontSize: "16px",
              outline: "none"
            }}
          />



          {/* PROFILE RIGHT */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              color: "white"
            }}
          >

            <div
              style={{
                width: "55px",
                height: "55px",
                borderRadius: "50%",
                background: "white",
                color: "#145f58",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: "bold",
                fontSize: "22px"
              }}
            >
              A
            </div>


            <div>
              <h3 style={{ margin: 0 }}>
                Anjali
              </h3>

              <span>
                Patient
              </span>
            </div>

          </div>


        </div>




        {/* CONTENT */}

        <div
          style={{
            padding: "130px 50px 40px"
          }}
        >



          <div className="dashboard">


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
                value={nextMedicine ? nextMedicine.schedule : "No Reminder"}
                subtitle={` ${morningCount} |  ${afternoonCount} |  ${nightCount}`}
              />


              <StatCard
                icon={<FaBullseye />}
                title="ADHERENCE SCORE"
                value="94%"
                subtitle="Last 7 days"
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



          </div>


        </div>


      </div>


    </div>
  );
}


export default Dashboard;