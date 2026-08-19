import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaPills,
  FaBell,
  FaChartLine,
  FaCamera,
  FaRobot,
  FaUsers,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import "../styles/AboutSection.css";

const AUTOPLAY_MS = 5000;

const CARDS = [
  {
    icon: <FaPills />,
    label: "About PillSync",
    title: "Intelligent Medicine Management",
    text: "PillSync is an intelligent medicine reminder and medication tracking platform designed to help patients manage medicines, schedules, adherence and timely refills from one place.",
  },
  {
    icon: <FaBell />,
    label: "Smart Reminders",
    title: "Smart Medication Reminders",
    text: "Schedule medication reminders and keep track of Taken, Missed and Pending doses to maintain a consistent medication routine.",
  },
  {
    icon: <FaChartLine />,
    label: "Medication Adherence",
    title: "Medication Adherence Tracking",
    text: "Monitor medication history, taken and missed doses, adherence percentage and adherence trends through clear analytics.",
  },
  {
    icon: <FaCamera />,
    label: "Prescription OCR",
    title: "Prescription & Medicine OCR",
    text: "Extract important medicine information from prescription or medicine images and reduce manual data entry.",
  },
  {
    icon: <FaRobot />,
    label: "AI Refill Management",
    title: "Intelligent Refill Management",
    text: "Track medicine stock, estimate depletion, identify low-stock medicines and support timely refill reminders.",
  },
  {
    icon: <FaUsers />,
    label: "Caregiver Support",
    title: "Caregiver Monitoring",
    text: "Support caregivers with patient medication monitoring, missed-dose alerts, refill notifications and adherence information.",
  },
];

function AboutSection() {
  const total = CARDS.length;

  const [activeIndex, setActiveIndex] = useState(0);
  // Position of the centered slide on the "raw" grid. The cards are rendered
  // three times (start / middle / end copies) so the active card always has a
  // neighbour on both sides. rawIndex only ever lives inside [total, 2*total-1]
  // (the middle copy); when it would leave that range it snaps back, which
  // makes the loop infinite and seamless in both directions.
  const [rawIndex, setRawIndex] = useState(total);
  const [noTransition, setNoTransition] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const timerRef = useRef(null);
  const rawRef = useRef(total);

  // Slides are the cards repeated 3x; distance is measured on the raw grid so
  // neighbours stay correct at the wrap-around points.
  const slides = [...CARDS, ...CARDS, ...CARDS];

  // Position the active card in the centre of the carousel. The slide width is
  // read from the --card-w CSS variable, so each responsive breakpoint decides
  // how many cards are visible.
  const applyTransform = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const containerWidth = container.getBoundingClientRect().width;
    const cardWidthPct =
      parseFloat(getComputedStyle(container).getPropertyValue("--card-w")) ||
      33.333;
    const cardWidth = (containerWidth * cardWidthPct) / 100;
    track.style.transform = `translateX(${
      containerWidth / 2 - (rawRef.current + 0.5) * cardWidth
    }px)`;
  }, []);

  useEffect(() => {
    applyTransform();
  }, [rawIndex, noTransition, applyTransform]);

  useEffect(() => {
    const onResize = () => applyTransform();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyTransform]);

  // Move the carousel to a raw index, wrapping around seamlessly. The snap
  // frame has transitions disabled for a single paint so the jump is invisible.
  const goRaw = useCallback(
    (nextRaw) => {
      let target = nextRaw;
      let snapped = false;

      if (target >= 2 * total) {
        target = total;
        snapped = true;
      } else if (target < total) {
        target = 2 * total - 1;
        snapped = true;
      }

      if (snapped) {
        setNoTransition(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setNoTransition(false));
        });
      }

      rawRef.current = target;
      setRawIndex(target);
      setActiveIndex(((target % total) + total) % total);
    },
    [total]
  );

  const goNext = useCallback(() => goRaw(rawRef.current + 1), [goRaw]);
  const goPrev = useCallback(() => goRaw(rawRef.current - 1), [goRaw]);
  const goTo = useCallback((index) => goRaw(index + total), [goRaw, total]);

  // Auto-play: advance every 5 seconds. Restarting the interval on manual
  // navigation resets the countdown. Cleaned up on unmount (no leaks).
  const restartAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reducedMotion) return;
    timerRef.current = setInterval(goNext, AUTOPLAY_MS);
  }, [goNext, reducedMotion]);

  useEffect(() => {
    restartAutoplay();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restartAutoplay]);

  const stopAutoplay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Manual navigation — move the carousel and restart the 5-second countdown
  // so it doesn't auto-advance right after the user interacts.
  const handleNext = useCallback(() => {
    goNext();
    restartAutoplay();
  }, [goNext, restartAutoplay]);

  const handlePrev = useCallback(() => {
    goPrev();
    restartAutoplay();
  }, [goPrev, restartAutoplay]);

  const handleGoTo = useCallback(
    (index) => {
      goTo(index);
      restartAutoplay();
    },
    [goTo, restartAutoplay]
  );

  return (
    <section id="about" className="about-section">
      <div className="about-container">
        <span className="about-eyebrow">About PillSync</span>

        <h2 className="about-heading">
          Smarter Medication Management, Better Adherence
        </h2>

        <p className="about-intro">
          PillSync brings medication scheduling, adherence tracking, prescription
          assistance, intelligent refill management and caregiver support
          together in one platform.
        </p>

        <div
          className="about-carousel"
          ref={containerRef}
          onMouseEnter={stopAutoplay}
          onMouseLeave={restartAutoplay}
          onFocus={stopAutoplay}
          onBlur={restartAutoplay}
        >
          <div
            className={`about-track${noTransition ? " no-transition" : ""}`}
            ref={trackRef}
          >
            {slides.map((card, index) => {
              const distance = Math.abs(index - rawIndex);
              const stateClass =
                distance === 0
                  ? "is-active"
                  : distance === 1
                    ? "is-neighbor"
                    : "is-far";
              return (
                <div
                  className={`about-slide ${stateClass}`}
                  key={`${card.title}-${index}`}
                  aria-hidden={distance > 1}
                >
                  <article className="about-card">
                    <span className="about-card-icon" aria-hidden="true">
                      {card.icon}
                    </span>
                    <span className="about-card-label">{card.label}</span>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                </div>
              );
            })}
          </div>
        </div>

        <div className="about-controls">
          <button
            type="button"
            className="about-nav-btn about-prev"
            onClick={handlePrev}
            aria-label="Previous slide"
          >
            <FaChevronLeft />
          </button>

          <div className="about-dots" role="group" aria-label="About slides">
            {CARDS.map((card, index) => (
              <button
                type="button"
                key={card.title}
                className={`about-dot${index === activeIndex ? " is-active" : ""}`}
                onClick={() => handleGoTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeIndex}
              />
            ))}
          </div>

          <button
            type="button"
            className="about-nav-btn about-next"
            onClick={handleNext}
            aria-label="Next slide"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;
