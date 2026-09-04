import { Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

import "../styles/ComingSoon.css";

// Placeholder page for routes that are planned but not built yet
// (Features, About, Blog, Help Center, Privacy Policy, Terms, Disclaimer).
function ComingSoon({ title = "Coming Soon" }) {
  return (
    <section className="coming-soon">
      <div className="coming-soon-card glass">
        <span className="coming-soon-icon">≡ƒÆè</span>
        <h1>{title}</h1>
        <p>
          This page is under construction. We're working hard to bring it to
          you ΓÇö stay tuned!
        </p>
        <Link to="/" className="coming-soon-back">
          <FaArrowLeft />
          Back to Home
        </Link>
      </div>
    </section>
  );
}

export default ComingSoon;
