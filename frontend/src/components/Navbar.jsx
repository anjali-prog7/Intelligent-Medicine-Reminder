import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Navbar.css";

function Navbar() {

  const navigate = useNavigate();

  return (
    <nav className="navbar">

      {/* Logo */}
      <div 
        className="logo"
        onClick={() => navigate("/")}
      >
        💊 <span>PillSync</span>
      </div>


      {/* Menu */}
      <ul>

        <li onClick={() => navigate("/")}>
          Home
        </li>

        <li onClick={() => navigate("/dashboard")}>
          Dashboard
        </li>

        <li onClick={() => navigate("/medicines")}>
          Medicine
        </li>

        <li onClick={() => navigate("/reminders")}>
          Reminder
        </li>

        <li onClick={() => navigate("/aiassistant")}>
          AI Assistant
        </li>

        <li onClick={() => navigate("/features")}>
          Features
        </li>

      </ul>


      {/* Signup Button */}
      <button
        className="signup-btn"
        onClick={() => navigate("/register")}
      >
        Sign Up
      </button>


    </nav>
  );
}

export default Navbar;