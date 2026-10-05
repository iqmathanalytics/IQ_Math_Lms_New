import React, { memo } from "react";

/**
 * GPU-friendly tech canvas — CSS-only transforms/opacity (no Framer loops).
 * Keeps the login page smooth without main-thread animation cost.
 */
const TechAuthBackground: React.FC = () => (
  <div className="auth-tech-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div className="auth-tech-wash absolute inset-0" />
    <div className="auth-tech-grid absolute -inset-12" />

    <div className="auth-tech-orb auth-tech-orb--blue" />
    <div className="auth-tech-orb auth-tech-orb--green" />
    <div className="auth-tech-orb auth-tech-orb--center" />

    <svg
      className="auth-tech-circuits absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="authCircuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0088C7" />
          <stop offset="100%" stopColor="#8DC63F" />
        </linearGradient>
      </defs>
      <path
        className="auth-circuit-path auth-circuit-path--a"
        d="M80 120 H280 V280 H480 V160 H720 V320 H980"
        fill="none"
        stroke="url(#authCircuitGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        className="auth-circuit-path auth-circuit-path--b"
        d="M1100 680 H860 V480 H640 V600 H400 V420 H180"
        fill="none"
        stroke="url(#authCircuitGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        className="auth-circuit-path auth-circuit-path--c"
        d="M200 700 V520 H360 V300 H560"
        fill="none"
        stroke="#0088C7"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        className="auth-circuit-path auth-circuit-path--d"
        d="M1000 100 V260 H820 V400"
        fill="none"
        stroke="#8DC63F"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>

    <span className="auth-tech-node" style={{ left: "14%", top: "20%" }} />
    <span className="auth-tech-node auth-tech-node--green" style={{ left: "78%", top: "24%", animationDelay: "0.8s" }} />
    <span className="auth-tech-node auth-tech-node--green" style={{ left: "24%", top: "70%", animationDelay: "1.4s" }} />
    <span className="auth-tech-node" style={{ left: "86%", top: "66%", animationDelay: "0.4s" }} />
    <span className="auth-tech-node" style={{ left: "50%", top: "14%", animationDelay: "1.1s" }} />
    <span className="auth-tech-node auth-tech-node--green" style={{ left: "60%", top: "80%", animationDelay: "1.8s" }} />

    <div className="auth-tech-scan" />
  </div>
);

export default memo(TechAuthBackground);
