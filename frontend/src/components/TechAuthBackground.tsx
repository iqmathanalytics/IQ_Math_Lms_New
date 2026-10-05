import React, { memo } from "react";

/**
 * Lightweight auth canvas — fewer animated nodes, GPU-friendly transforms only.
 */
const TechAuthBackground: React.FC = () => (
  <div className="auth-tech-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    <div className="auth-tech-wash absolute inset-0" />
    <div className="auth-tech-grid absolute -inset-12" />

    <div className="auth-tech-orb auth-tech-orb--blue" />
    <div className="auth-tech-orb auth-tech-orb--green" />

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
    </svg>

    <span className="auth-tech-node" style={{ left: "18%", top: "22%" }} />
    <span className="auth-tech-node auth-tech-node--green" style={{ left: "78%", top: "28%", animationDelay: "1s" }} />
    <span className="auth-tech-node" style={{ left: "62%", top: "72%", animationDelay: "1.6s" }} />
  </div>
);

export default memo(TechAuthBackground);
