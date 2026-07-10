import React from "react";
import { useNavigate } from "react-router-dom";
function Hero() {
    const navigate = useNavigate();
  return (
    <section className="hero">

      <div className="left">

        <h4>🛡️ Your Health, Our Priority</h4>

        <h1>
          Welcome to <br />
          <span>PillSync</span>
        </h1>

        <p>
          Your intelligent medicine reminder and medication tracking
          platform. Stay on track, never miss a dose, and take charge
          of your health.
        </p>

        <div className="features">

          <div className="feature">
            🔔
            <h3>Smart Reminders</h3>
            <p>Never miss a dose</p>
          </div>

          <div className="feature">
            📊
            <h3>Track & Analyze</h3>
            <p>Monitor your progress</p>
          </div>

          <div className="feature">
            🤖
            <h3>AI Assistant</h3>
            <p>Health Support 24/7</p>
          </div>

        </div>

      </div>

      <div className="right">

        <div className="login-card">

          <h2>Login to your account</h2>
          <p>Glad to see you again! 👋</p>

          <input type="email" placeholder="Email address" />

          <input type="password" placeholder="Password" />

          <div className="remember">
            <label>
              <input type="checkbox" />
              Remember me
            </label>

            <span>Forgot password?</span>
          </div>

          <button className="login-btn"onClick={() => navigate("/dashboard")}>
          Login
          </button>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="social">

            <button>Google</button>

            <button>Apple</button>

          </div>

          <p className="signup">
            Don't have an account? <span>Sign Up</span>
          </p>

        </div>

      </div>

    </section>
  );
}

export default Hero;