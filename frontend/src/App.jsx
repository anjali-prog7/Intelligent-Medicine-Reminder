import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Medicines from "./pages/Medicines";
import Reminders from "./pages/Reminders";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Footer from "./components/Footer";

import "./App.css";


function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Footer />
    </>
  );
}


function App() {

  return (

    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />


      {/* Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />


      {/* Medicines Separate Page */}
      <Route path="/medicines" element={<Medicines />} />


      {/* Reminder Separate Page */}
      <Route path="/reminders" element={<Reminders />} />


      <Route path="/profile" element={<Profile />} />


      <Route path="*" element={<NotFound />} />


    </Routes>

  );
}


export default App;