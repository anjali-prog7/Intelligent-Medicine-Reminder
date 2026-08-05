import { useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaMagic, FaExclamationCircle } from "react-icons/fa";

import Sidebar from "../components/Sidebar";
import DashboardTopNav from "../components/DashboardTopNav";
import RefillPredictionForm from "../components/refill/RefillPredictionForm";
import PredictionResultCards from "../components/refill/PredictionResultCards";
import LowStockAlert from "../components/refill/LowStockAlert";
import RefillReminder from "../components/refill/RefillReminder";
import CaregiverNotification from "../components/refill/CaregiverNotification";
import RefillAnalytics from "../components/refill/RefillAnalytics";
import {
  VALID_BUFFER_DAYS,
  parseNum,
  validateForm,
  computePrediction,
} from "../utils/refillPrediction";
import "../styles/Refill.css";

const INITIAL_FORM = {
  medicineName: "",
  initialQty: "",
  dosageFrequency: "",
  qtyPerDose: "",
  missedDoses: "",
  manualStock: "",
  trackingStartDate: "",
  bufferDays: "5",
};

function Refill() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [predicting, setPredicting] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [formError, setFormError] = useState("");
  const resultsRef = useRef(null);

  const handleChange = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Live validation: impossible inputs are rejected as soon as they are typed.
    setFormError(validateForm(next));
  };

  // Every calculation lives in the pure engine (utils/refillPrediction.js).
  const prediction = useMemo(() => computePrediction(form), [form]);

  const handlePredict = () => {
    const medicineName = (form.medicineName || "").trim();
    const initialQty = parseNum(form.initialQty);
    const dosageFrequency = parseNum(form.dosageFrequency);
    const qtyPerDose = parseNum(form.qtyPerDose);

    if (!medicineName || initialQty <= 0 || dosageFrequency <= 0 || qtyPerDose <= 0) {
      setFormError(
        "Please fill in the medicine name, initial quantity, dosage frequency and quantity per dose."
      );
      return;
    }
    if (!VALID_BUFFER_DAYS.includes(parseInt(form.bufferDays, 10))) {
      setFormError("Refill Buffer Days must be 3, 5 or 7 days.");
      return;
    }
    const rejectionError = validateForm(form);
    if (rejectionError) {
      setFormError(rejectionError);
      return;
    }
    setFormError("");
    setPredicting(true);
    setTimeout(() => {
      setPredicting(false);
      setRunKey((key) => key + 1);
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 650);
  };

  const showResults = prediction.hasPrediction;

  return (
    <div className="refill-layout">
      <Sidebar />
      <div className="refill-content-wrapper">
        <DashboardTopNav />
        <div className="refill-content">
          <div className="refill-inner">
            <div className="refill-page-header">
              <div>
                <div className="refill-page-title">
                  <span className="refill-page-title-icon">
                    <FaCalendarAlt />
                  </span>
                  AI Refill Prediction Engine
                </div>
                <p className="refill-page-subtitle">
                  Monitor medicine stock, predict refill dates and receive
                  intelligent refill reminders.
                </p>
              </div>
              <span className="refill-header-badge">Live Predictions</span>
            </div>

            {(formError || prediction.validationError) && (
              <div className="refill-form-error">
                <FaExclamationCircle />{" "}
                {formError || prediction.validationError}
              </div>
            )}

            <div className="refill-main-grid">
              <RefillPredictionForm
                form={form}
                onChange={handleChange}
                onPredict={handlePredict}
                predicting={predicting}
              />

              <div
                key={runKey}
                className="refill-results-stack animate-fadeIn"
                ref={resultsRef}
              >
                {showResults ? (
                  <>
                    <LowStockAlert prediction={prediction} />
                    <PredictionResultCards prediction={prediction} />
                    <div className="refill-msg-row">
                      <RefillReminder prediction={prediction} />
                      <CaregiverNotification prediction={prediction} />
                    </div>
                  </>
                ) : (
                  <div className="refill-empty-state">
                    <div className="refill-empty-icon">
                      <FaMagic />
                    </div>
                    <h3>Your refill prediction will appear here</h3>
                    <p>
                      Enter your medicine details on the left — results update
                      automatically as you type.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {showResults && <RefillAnalytics prediction={prediction} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Refill;
