import Navbar from "../components/Navbar";
import "./Medicines.css";
import { useState, useEffect } from "react";

import {
  FaPills,
  FaPlus,
  FaSearch,
  FaHeartbeat,
  FaClock,
  FaUsers,
  FaFileMedical,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
function Medicines() {

  const defaultMedicines = [
    {
      id: 1,
      medicine: "Paracetamol",
      disease: "Fever",
      dosage: "500 mg",
      schedule: "Morning",
      status: "Active",
    },
    {
      id: 2,
      medicine: "Metformin",
      disease: "Diabetes",
      dosage: "850 mg",
      schedule: "Night",
      status: "Active",
    },
    {
      id: 3,
      medicine: "Vitamin D",
      disease: "Deficiency",
      dosage: "1 Tablet",
      schedule: "Afternoon",
      status: "Pending",
    },
  ];

  const [medicines, setMedicines] = useState(() => {
    const saved = localStorage.getItem("medicines");
    return saved ? JSON.parse(saved) : defaultMedicines;
  });

  const [newMedicine, setNewMedicine] = useState({
    medicine: "",
    disease: "",
    dosage: "",
    schedule: "",
    status: "Active",
  });

  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");

  const [filterSchedule, setFilterSchedule] = useState("All");

  const [editId, setEditId] = useState(null);

  const [isEditing, setIsEditing] = useState(false);

  const defaultProfiles = [
    {
      id: 1,
      name: "Anjali",
      role: "Primary User",
    },
    {
      id: 2,
      name: "Mother",
      role: "Family Profile",
    },
    {
      id: 3,
      name: "Father",
      role: "Family Profile",
    },
  ];

  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem("profiles");
    return saved ? JSON.parse(saved) : defaultProfiles;
  });

  const [newProfile, setNewProfile] = useState({
    name: "",
    role: "",
  });

  const [showProfileForm, setShowProfileForm] = useState(false);

  const [prescription, setPrescription] = useState(() => {
    return localStorage.getItem("prescription") || "";
  });

  const [selectedFile, setSelectedFile] = useState(null);

  const [fileURL, setFileURL] = useState("");

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleChange = (e) => {
    setNewMedicine({
      ...newMedicine,
      [e.target.name]: e.target.value,
    });
  };

  const addMedicine = () => {

    if (
      !newMedicine.medicine ||
      !newMedicine.disease ||
      !newMedicine.dosage ||
      !newMedicine.schedule
    ) {
      alert("Please fill all fields");
      return;
    }

    if (isEditing) {

      setMedicines(
        medicines.map((item) =>
          item.id === editId
            ? { ...newMedicine, id: editId }
            : item
        )
      );

      setIsEditing(false);
      setEditId(null);

    } else {

      setMedicines([
        ...medicines,
        {
          id: Date.now(),
          ...newMedicine,
        },
      ]);

    }

    setNewMedicine({
      medicine: "",
      disease: "",
      dosage: "",
      schedule: "",
      status: "Active",
    });

    setShowForm(false);

  };

  const editMedicine = (item) => {
    setNewMedicine(item);
    setEditId(item.id);
    setIsEditing(true);
    setShowForm(true);
  };

  useEffect(() => {
    localStorage.setItem("medicines", JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem("profiles", JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (prescription) {
      localStorage.setItem("prescription", prescription);
    }
  }, [prescription]);

  const deleteMedicine = (id) => {

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this medicine?"
    );

    if (confirmDelete) {
      setMedicines(
        medicines.filter((item) => item.id !== id)
      );
    }

  };

  const addProfile = () => {

    if (!newProfile.name || !newProfile.role) {
      alert("Please fill all fields");
      return;
    }

    setProfiles([
      ...profiles,
      {
        id: Date.now(),
        ...newProfile,
      },
    ]);

    setNewProfile({
      name: "",
      role: "",
    });

    setShowProfileForm(false);

  };

  const deleteProfile = (id) => {

    if (window.confirm("Delete this profile?")) {

      setProfiles(
        profiles.filter((item) => item.id !== id)
      );

    }

  };

  const uploadPrescription = () => {

    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    setPrescription(selectedFile.name);

    setFileURL(URL.createObjectURL(selectedFile));
    setSelectedFile(null);

    alert("Prescription uploaded successfully!");

  };

  const deletePrescription = () => {

    if (window.confirm("Delete prescription?")) {

      setPrescription("");

      setFileURL("");

      localStorage.removeItem("prescription");

    }

  };

  const diseases = [...new Set(medicines.map((item) => item.disease))];

  const morningMedicines = medicines.filter(
    (item) => item.schedule === "Morning"
  );

  const afternoonMedicines = medicines.filter(
    (item) => item.schedule === "Afternoon"
  );

  const nightMedicines = medicines.filter(
    (item) => item.schedule === "Night"
  );
  return (
    <>
      <Navbar />

      <div className="medicine-page">

        {/* Header */}

        <div className="medicine-header">

          <div>

            <h1>Medicine Management</h1>

            <p>
              Manage medicines, dosage schedules, diseases and prescriptions
              from one place.
            </p>

          </div>

          <button
            className="add-btn"
            onClick={() => setShowForm(!showForm)}
          >
            <FaPlus />
            Add Medicine
          </button>

        </div>



        {/* Search */}

        <div className="top-controls">

          <div className="search-box">

            <FaSearch className="search-icon" />

            <input
              type="text"
              placeholder="Search medicines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>

          <div className="filter-box">

            <select
              value={filterSchedule}
              onChange={(e) => setFilterSchedule(e.target.value)}
            >
              <option value="All">All Schedules</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Night">Night</option>
            </select>

          </div>

        </div>

        {showForm && (
          <div className="add-form">

            <h2>Add New Medicine</h2>

            <input
              type="text"
              name="medicine"
              placeholder="Medicine Name"
              value={newMedicine.medicine}
              onChange={handleChange}
            />

            <input
              type="text"
              name="disease"
              placeholder="Disease"
              value={newMedicine.disease}
              onChange={handleChange}
            />

            <input
              type="text"
              name="dosage"
              placeholder="Dosage"
              value={newMedicine.dosage}
              onChange={handleChange}
            />

            <input
              type="text"
              name="schedule"
              placeholder="Schedule"
              value={newMedicine.schedule}
              onChange={handleChange}
            />

            <button onClick={addMedicine}>
              {isEditing ? "Update Medicine" : "Save Medicine"}
            </button>

          </div>
        )}

        {/* Feature Cards */}

        <div className="feature-grid">

          <div className="feature-card">

            <FaPills className="card-icon" />

            <h3>Medicine Management</h3>

            <p>
              Add, update and organize all prescribed medicines.
            </p>

          </div>

          <div className="feature-card">

            <FaHeartbeat className="card-icon" />

            <h3>Disease Tracking</h3>

            <p>
              Monitor diseases and associated medications.
            </p>

          </div>

          <div className="feature-card">

            <FaClock className="card-icon" />

            <h3>Dosage Scheduling</h3>

            <p>
              Track medicine timings for morning, afternoon and night.
            </p>

          </div>

          <div className="feature-card">

            <FaUsers className="card-icon" />

            <h3>Multiple Profiles</h3>

            <p>
              Manage medicines for family members from one dashboard.
            </p>

          </div>

          <div className="feature-card">

            <FaFileMedical className="card-icon" />

            <h3>Prescription Management</h3>

            <p>
              Upload and organize digital prescriptions securely.
            </p>

          </div>

        </div>

        {/* Medicine Table */}

        <div className="table-card">

          <div className="table-title">

            <h2>
              Medicine List
              <span className="medicine-count">
                ({medicines.length})
              </span>
            </h2>

          </div>

          <table>

            <thead>

              <tr>

                <th>Medicine</th>

                <th>Disease</th>

                <th>Dosage</th>

                <th>Schedule</th>

                <th>Status</th>

                <th>Action</th>

              </tr>

            </thead>

            <tbody>

              {
                medicines
                  .filter((item) => {
                    const matchSearch = item.medicine
                      .toLowerCase()
                      .includes(search.toLowerCase());

                    const matchSchedule =
                      filterSchedule === "All" ||
                      item.schedule === filterSchedule;

                    return matchSearch && matchSchedule;
                  })
                  .map((item) => (

                    <tr key={item.id}>

                      <td>{item.medicine}</td>

                      <td>{item.disease}</td>

                      <td>{item.dosage}</td>

                      <td>{item.schedule}</td>


                      <td>
                        <span className="status">
                          {item.status}
                        </span>
                      </td>

                      <td>

                        <button
                          className="edit-btn"
                          onClick={() => editMedicine(item)}
                        >
                          <FaEdit />
                        </button>

                        <button
                          className="delete-btn"
                          onClick={() => deleteMedicine(item.id)}
                        >
                          <FaTrash />
                        </button>

                      </td>

                    </tr>

                  ))}

            </tbody>

          </table>

        </div>

        {/* Bottom Section */}

        <div className="bottom-grid">

          {/* Disease Tracking */}

          <div className="info-card">

            <h2>Disease Tracking</h2>

            {diseases.map((disease, index) => (

              <div key={index}>

                <div className="disease-item">

                  <div>

                    <h4>{disease}</h4>

                    <p>
                      {
                        medicines.filter(
                          (item) => item.disease === disease
                        ).length
                      } Medicine(s)
                    </p>

                  </div>

                  <span className="badge green">
                    Active
                  </span>

                </div>

                <div className="progress">

                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(
                        medicines.filter(
                          (item) => item.disease === disease
                        ).length * 25,
                        100
                      )
                        }%`,
                    }}
                  ></div>

                </div>

              </div>

            ))}

          </div>

          {/* Dosage Scheduling */}

          <div className="info-card">

            <h2>Dosage Scheduling</h2>

            <div className="schedule">

              {/* Morning */}

              <div className="schedule-box">

                <h4> Morning</h4>

                {morningMedicines.length > 0 ? (

                  morningMedicines.map((item) => (
                    <p key={item.id}> {item.medicine}</p>
                  ))

                ) : (

                  <p>No medicines</p>

                )}

              </div>

              {/* Afternoon */}

              <div className="schedule-box">

                <h4>☀ Afternoon</h4>

                {afternoonMedicines.length > 0 ? (

                  afternoonMedicines.map((item) => (
                    <p key={item.id}> {item.medicine}</p>
                  ))

                ) : (

                  <p>No medicines</p>

                )}

              </div>

              {/* Night */}

              <div className="schedule-box">

                <h4> Night</h4>

                {nightMedicines.length > 0 ? (

                  nightMedicines.map((item) => (
                    <p key={item.id}> {item.medicine}</p>
                  ))

                ) : (

                  <p>No medicines</p>

                )}

              </div>

            </div>

          </div>


          {/* Multiple Profiles */}

          <div className="info-card">

            <h2>Multiple Profiles</h2>

            <button
              className="add-btn"
              style={{ marginBottom: "20px" }}
              onClick={() => setShowProfileForm(!showProfileForm)}
            >
              <FaPlus /> Add Profile
            </button>

            {showProfileForm && (

              <div className="add-form">

                <input
                  type="text"
                  placeholder="Profile Name"
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile({
                      ...newProfile,
                      name: e.target.value,
                    })
                  }
                />

                <input
                  type="text"
                  placeholder="Role"
                  value={newProfile.role}
                  onChange={(e) =>
                    setNewProfile({
                      ...newProfile,
                      role: e.target.value,
                    })
                  }
                />

                <button onClick={addProfile}>
                  Save Profile
                </button>

              </div>

            )}

            {profiles.map((profile) => (

              <div className="profile" key={profile.id}>

                <div className="avatar">
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <h4>{profile.name}</h4>
                  <p>{profile.role}</p>
                </div>

                <button
                  className="delete-btn"
                  onClick={() => deleteProfile(profile.id)}
                >
                  <FaTrash />
                </button>

              </div>

            ))}

          </div>

          {/* Prescription Management */}

          <div className="info-card">

            <h2>Prescription Management</h2>

            <div className="upload-box">

              <FaFileMedical className="upload-icon" />

              <h3>Upload Prescription</h3>

              <p>Select a PDF or Image file.</p>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />

              <br /><br />

              <button
                className="upload-btn"
                onClick={uploadPrescription}
              >
                Upload File
              </button>

              {prescription && (

                <div style={{ marginTop: "20px" }}>

                  <h4>Uploaded File</h4>

                  <p>{prescription}</p>

                  {fileURL && (
                    <button
                      className="upload-btn"
                      style={{ marginTop: "10px", marginRight: "10px" }}
                      onClick={() => window.open(fileURL, "_blank")}
                    >
                      👁 View Prescription
                    </button>
                  )}

                  <button
                    className="delete-btn"
                    onClick={deletePrescription}
                  >
                    <FaTrash /> Delete
                  </button>

                </div>

              )}

            </div>

          </div>


        </div>

      </div>

    </>

  );

}

export default Medicines;