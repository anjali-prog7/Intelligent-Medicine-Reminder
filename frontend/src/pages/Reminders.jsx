import { useState, useEffect } from "react";
import axios from "axios";
import {
  FaBell,
  FaPlus,
  FaClock,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

import Navbar from "../components/Navbar";
import "../styles/Reminder.css";


function Reminders() {

  const [loaded, setLoaded] = useState(false);

  const [medicineList, setMedicineList] = useState([]);

  const [showModal, setShowModal] = useState(false);

  const [editIndex, setEditIndex] = useState(null);

  const [reminders, setReminders] = useState([]);

  const [formData, setFormData] = useState({
    medicine: "",
    disease: "",
    dosage: "",
    time: "",
    schedule: "",
    repeat: "Daily",
    startDate: "",
    endDate: "",

    push: true,
    email: false,
    sms: false,
    whatsapp: false,

    status: "Pending",
  });



  const sendNotification = (medicine, time) => {

    if (!("Notification" in window)) {
      alert("Browser does not support notifications");
      return;
    }

    if (Notification.permission === "granted") {

      new Notification("💊 PillSync Reminder", {
        body: `Time to take ${medicine} at ${time}`,
        icon: "/vite.svg",
      });

    } else if (Notification.permission !== "denied") {

      Notification.requestPermission().then((permission) => {

        if (permission === "granted") {

          new Notification("💊 PillSync Reminder", {
            body: `Time to take ${medicine} at ${time}`,
            icon: "/vite.svg",
          });

        }

      });

    }

  };

  useEffect(() => {

    const savedReminders =
      JSON.parse(localStorage.getItem("reminders")) || [];

    setReminders(savedReminders);

    const savedMedicines =
      JSON.parse(localStorage.getItem("medicines")) || [];

    setMedicineList(savedMedicines);

    setLoaded(true);

  }, []);

  useEffect(() => {

    if (!loaded) return;

    localStorage.setItem(
      "reminders",
      JSON.stringify(reminders)
    );

  }, [reminders, loaded]);

  useEffect(() => {

    if ("Notification" in window) {

      if (Notification.permission !== "granted") {

        Notification.requestPermission();

      }

    }

  }, []);

  const handleChange = (e) => {

    const { name, value, type, checked } = e.target;

    setFormData({

      ...formData,

      [name]:
        type === "checkbox"
          ? checked
          : value,

    });

  };

  /*Save reminder function */

  const saveReminder = async () => {

    if (
      formData.medicine === "" ||
      formData.time === ""
    ) {

      alert("Please fill all required fields");

      return;
    }

    if (editIndex !== null) {

      const updated = [...reminders];

      updated[editIndex] = formData;

      setReminders(updated);

      setEditIndex(null);

    } else {

      try {

        const token = localStorage.getItem("access");
        console.log("TOKEN =", token);

        await axios.post(
          "http://127.0.0.1:8000/api/reminders/",
          {
            medicine: 2, // temporary
            reminder_time: formData.time,
            reminder_date: formData.startDate,
            status: "PENDING",
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      } catch (error) {

        console.log("Status:", error.response?.status);
  console.log("Data:", error.response?.data);
  console.log("Full Error:", error);
      }

      setReminders([
        ...reminders,
        formData,
      ]);

    }

    setFormData({
      medicine: "",
      disease: "",
      dosage: "",
      time: "",
      schedule: "",
      repeat: "Daily",
      startDate: "",
      endDate: "",

      push: true,
      email: false,
      sms: false,
      whatsapp: false,

      status: "Pending",
    });

    setShowModal(false);

    sendNotification(formData.medicine, formData.time);

  };

  const editReminder = (index) => {

    setFormData(reminders[index]);

    setEditIndex(index);

    setShowModal(true);

  };

  const deleteReminder = (index) => {

    if (window.confirm("Delete Reminder?")) {

      const updated = reminders.filter(
        (_, i) => i !== index
      );

      setReminders(updated);

    }

  };

  /*Export csv */

  const exportCSV = () => {

    const rows = [
      ["Medicine", "Time", "Schedule", "Status"]
    ];

    reminders.forEach(item => {
      rows.push([
        item.medicine,
        item.time,
        item.schedule,
        item.status
      ]);
    });

    const csv =
      rows.map(e => e.join(",")).join("\n");

    const blob = new Blob([csv], {
      type: "text/csv"
    });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = "MedicationHistory.csv";

    a.click();

  };

  const totalReminders = reminders.length;

  const takenCount = reminders.filter(
    (item) => item.status === "Taken"
  ).length;

  const adherence =
    totalReminders === 0
      ? 0
      : Math.round((takenCount / totalReminders) * 100);



  const pendingReminders = reminders.filter(
    (item) => item.status === "Pending"
  );

  const nextReminder =
    pendingReminders.length > 0
      ? pendingReminders[0]
      : null;



  const [countdown, setCountdown] = useState("--:--:--");

  useEffect(() => {

    if (!nextReminder || !nextReminder.time) return;

    const timer = setInterval(() => {

      const now = new Date();

      const [hour, minute] = nextReminder.time.split(":");

      const target = new Date();

      target.setHours(Number(hour));
      target.setMinutes(Number(minute));
      target.setSeconds(0);

      let diff = target - now;

      if (diff < 0) {
        diff += 24 * 60 * 60 * 1000;
      }

      const h = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
      const m = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");

      setCountdown(`${h}:${m}:${s}`);

    }, 1000);

    return () => clearInterval(timer);

  }, [nextReminder]);

  /* Automatic Browser Notification at Reminder Time*/


  useEffect(() => {

    const interval = setInterval(() => {

      const now = new Date();

      const currentTime =
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      reminders.forEach((item) => {

        if (
          item.status === "Pending" &&
          item.time === currentTime
        ) {

          sendNotification(
            item.medicine,
            item.time
          );

        }

      });

    }, 60000);

    return () => clearInterval(interval);

  }, [reminders]);






  useEffect(() => {

    const interval = setInterval(() => {

      const now = new Date();

      const currentTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      reminders.forEach((item) => {

        if (
          item.time === currentTime &&
          item.status === "Pending"
        ) {
          sendNotification(item.medicine, item.time);
        }

      });

    }, 60000);

    return () => clearInterval(interval);

  }, [reminders]);


  return (

    <>

      <Navbar />

      <div className="reminder-page">

        <div className="reminder-header">

          <div>

            <h1>Reminder System</h1>

            <p>
              Manage all medicine reminders
            </p>

          </div>

          <button

            className="add-btn"

            onClick={() => {

              setShowModal(true);

              setEditIndex(null);

            }}

          >

            <FaPlus />

            Add Reminder

          </button>

        </div>

        {/* Today's Summary */}

        <div className="summary-grid">

          <div className="summary-card">
            <h3>Total Reminders</h3>
            <h1>{reminders.length}</h1>
          </div>

          <div className="summary-card">
            <h3>Pending</h3>
            <h1>
              {
                reminders.filter(
                  (item) => item.status === "Pending"
                ).length
              }
            </h1>
          </div>

          <div className="summary-card">
            <h3>Taken</h3>
            <h1>
              {
                reminders.filter(
                  (item) => item.status === "Taken"
                ).length
              }
            </h1>
          </div>

        </div>


        <div className="countdown-card">

          <div className="countdown-left">

            <div className="countdown-icon">
              ⏳
            </div>

            <div>

              <h2>Next Dose</h2>

              <h3>{nextReminder?.medicine || "No Reminder"}</h3>

              <p>
                <span>🕒 {nextReminder?.time}</span>

                <span>📅 {nextReminder?.schedule}</span>
              </p>

            </div>

          </div>

          <div className="countdown-right">

            <h1>{countdown}</h1>

            <p>Remaining</p>

          </div>

        </div>






        {/* Medication Adherence */}

        <div className="adherence-card">

          <div className="adherence-top">

            <h2>Medication Adherence</h2>

            <h1>{adherence}%</h1>

          </div>

          <div className="progress-bar">

            <div
              className="progress-fill"
              style={{
                width: `${adherence}%`,
              }}
            ></div>

          </div>

          <p>

            {takenCount} of {totalReminders} reminders completed

          </p>

        </div>

        {/* Reminder Cards */}

        <div className="reminder-grid">

          {reminders.length === 0 ? (

            <div className="empty">

              <h2>No Reminder Added</h2>

              <p>
                Click on Add Reminder
              </p>

            </div>

          ) : (

            reminders.map((item, index) => (

              <div
                className="reminder-card"
                key={index}
              >

                <div className="card-top">

                  <div>

                    <h2>{item.medicine}</h2>

                    <p><b>Disease :</b> {item.disease}</p>

                    <p><b>Dosage :</b> {item.dosage}</p>

                    <p>{item.schedule}</p>

                  </div>

                  <FaBell className="bell" />

                </div>

                <div className="time">

                  <FaClock />

                  <span>{item.time}</span>

                </div>

                <div className="info">

                  <p>

                    Repeat :
                    <b> {item.repeat}</b>

                  </p>

                  <p>

                    Status :

                    <b>

                      {item.status}

                    </b>

                  </p>

                </div>

                <div className="notify">

                  {item.push && <span>🔔 Push</span>}

                  {item.email && <span>📧 Email</span>}

                  {item.sms && <span>📩 SMS</span>}

                  {item.whatsapp && <span>💬 WhatsApp</span>}

                </div>

                <div className="actions">

                  <button

                    className="taken-btn"

                    onClick={() => {

                      const updated = [...reminders];

                      updated[index].status = "Taken";

                      setReminders(updated);

                    }}

                  >

                    Taken

                  </button>

                  <button

                    className="missed-btn"

                    onClick={() => {

                      const updated = [...reminders];

                      updated[index].status = "Missed";

                      setReminders(updated);

                    }}

                  >

                    Missed

                  </button>

                  <button

                    className="snooze-btn"

                    onClick={() => {

                      alert("Reminder Snoozed for 10 minutes");

                    }}

                  >

                    Snooze

                  </button>

                  <FaEdit

                    className="icon"

                    onClick={() => editReminder(index)}

                  />

                  <FaTrash

                    className="icon delete"

                    onClick={() => deleteReminder(index)}

                  />

                </div>

              </div>

            ))

          )}

        </div>


        {/* Upcoming Notifications */}

        <div className="notification-panel">

          <h2>Upcoming Notifications</h2>

          {

            reminders.filter(item => item.status === "Pending").length === 0 ?

              (

                <p>No Upcoming Notifications</p>

              ) : (

                reminders
                  .filter(item => item.status === "Pending")
                  .map((item, index) => (

                    <div
                      key={index}
                      className="notification-card"
                    >

                      <div>

                        <h3>{item.medicine}</h3>

                        <p>{item.time}</p>

                      </div>

                      <span>{item.schedule}</span>

                    </div>

                  ))

              )

          }

        </div>

        {/* Reminder History */}

        <div className="history">

          <div className="history-top">

            <h2>Reminder History</h2>

            <button
              className="export-btn"
              onClick={exportCSV}
            >
              Export CSV
            </button>

          </div>

          <table>

            <thead>

              <tr>

                <th>Medicine</th>

                <th>Disease</th>

                <th>Dosage</th>

                <th>Time</th>

                <th>Schedule</th>

                <th>Status</th>

                <th>Repeat</th>

              </tr>

            </thead>

            <tbody>

              {

                reminders.map((item, index) => (

                  <tr key={index}>

                    <td>{item.medicine}</td>

                    <td>{item.disease}</td>

                    <td>{item.dosage}</td>

                    <td>{item.time}</td>

                    <td>{item.schedule}</td>

                    <td>

                      <span
                        className={`status ${item.status.toLowerCase()}`}
                      >

                        {item.status}

                      </span>

                    </td>

                    <td>{item.repeat}</td>

                  </tr>

                ))

              }

            </tbody>

          </table>

        </div>





      </div>

      {showModal && (

        <div className="modal-overlay">

          <div className="modal-box">

            <h2>

              {editIndex !== null
                ? "Edit Reminder"
                : "Add Reminder"}

            </h2>

            <select
              name="medicine"
              value={formData.medicine}
              onChange={(e) => {

                const selected = medicineList.find(
                  (item) => item.medicine === e.target.value
                );

                if (selected) {
                  setFormData({
                    ...formData,
                    medicine: selected.medicine,
                    disease: selected.disease,
                    dosage: selected.dosage,
                    schedule: selected.schedule,
                  });
                }

              }}
            >
              <option value="">Select Medicine</option>

              {medicineList.map((item) => (
                <option key={item.id} value={item.medicine}>
                  {item.medicine}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={formData.disease}
              placeholder="Disease"
              readOnly
            />

            <input
              type="text"
              value={formData.dosage}
              placeholder="Dosage"
              readOnly
            />

            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
            />

            <select
              name="schedule"
              value={formData.schedule}
              onChange={handleChange}
            >

              <option>Morning</option>
              <option>Afternoon</option>
              <option>Night</option>

            </select>

            <select
              name="repeat"
              value={formData.repeat}
              onChange={handleChange}
            >

              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>

            </select>

            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
            />

            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
            />

            <h3>Notification Preference</h3>

            <label>

              <input
                type="checkbox"
                name="push"
                checked={formData.push}
                onChange={handleChange}
              />

              Push Notification

            </label>

            <label>

              <input
                type="checkbox"
                name="email"
                checked={formData.email}
                onChange={handleChange}
              />

              Email

            </label>

            <label>

              <input
                type="checkbox"
                name="sms"
                checked={formData.sms}
                onChange={handleChange}
              />

              SMS

            </label>

            <label>

              <input
                type="checkbox"
                name="whatsapp"
                checked={formData.whatsapp}
                onChange={handleChange}
              />

              WhatsApp

            </label>

            <div className="modal-buttons">

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                Cancel
              </button>

              <button
                onClick={saveReminder}
              >
                Save Reminder
              </button>

            </div>

          </div>

        </div>

      )}

    </>

  );

}

export default Reminders;