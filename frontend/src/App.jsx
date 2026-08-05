import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Medicines from "./pages/Medicines";
import Reminders from "./pages/Reminders";
import AiAssistant from "./pages/AiAssistant";
import PrescriptionOcr from "./pages/PrescriptionOcr";
import Refill from "./pages/Refill";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

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


      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      <Route path="/medicines" element={<ProtectedRoute><Medicines /></ProtectedRoute>} />

      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />

      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/aiassistant" element={<ProtectedRoute><AiAssistant /></ProtectedRoute>} />

      <Route path="/dashboard/prescription-ocr" element={<ProtectedRoute><PrescriptionOcr /></ProtectedRoute>} />

      <Route path="/refill" element={<ProtectedRoute><Refill /></ProtectedRoute>} />

      <Route path="*"  element={<NotFound />} />


    </Routes>

  );
}


export default App;