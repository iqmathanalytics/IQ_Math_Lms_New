import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import API_BASE_URL from './config';
import {
  User, Lock, Mail, ArrowRight, CheckCircle,
  ShieldCheck, LogIn, UserPlus, Eye, EyeOff,
  Smartphone, MessageSquare, AlertCircle, X
} from "lucide-react";
import BrandLogo from "./components/BrandLogo";
import TechAuthBackground from "./components/TechAuthBackground";
import { getHomePath, ROLE_STUDENT, saveSession } from "./utils/session";
import { resolveStudentCoursePath } from "./utils/courseAccess";

// 🔥 FIREBASE IMPORTS
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const looksLikePlaceholder = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return (
    s === "" ||
    s.includes("replace_me") ||
    s.startsWith("your_") ||
    s === "your_firebase_api_key" ||
    s === "your_sender_id" ||
    s === "your_app_id" ||
    s === "your_measurement_id"
  );
};

const FIREBASE_CONFIGURED = Boolean(
  !looksLikePlaceholder(firebaseConfig.apiKey) &&
  !looksLikePlaceholder(firebaseConfig.authDomain) &&
  !looksLikePlaceholder(firebaseConfig.projectId) &&
  !looksLikePlaceholder(firebaseConfig.messagingSenderId) &&
  !looksLikePlaceholder(firebaseConfig.appId)
);

const getFirebaseAuthSafe = () => {
  if (!FIREBASE_CONFIGURED) return null;
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    auth.useDeviceLanguage();
    return auth;
  } catch (err) {
    console.error("Firebase init failed:", err);
    return null;
  }
};

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier | null;
    recaptchaWidgetId?: number;
    recaptchaContainerId?: string;
    grecaptcha?: { reset: (widgetId?: number) => void };
  }
}

interface ToastState { show: boolean; message: string; type: "success" | "error"; }

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareCourseId = searchParams.get("course");
  /** null = chooser landing; signin/signup = fullscreen auth sheet */
  const [authPanel, setAuthPanel] = useState<"signin" | "signup" | null>(null);
  const isSignUp = authPanel === "signup";
  const role = "student";
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  // OTP flow is only for signup verification
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showSignupOtpInput, setShowSignupOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isCaptchaSolved, setIsCaptchaSolved] = useState(false);

  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [showPassword, setShowPassword] = useState(false);

  const activeText = isSignUp ? "text-iqGreen" : "text-iqBlue";
  const activeBtn = isSignUp ? "btn-accent" : "btn-primary";

  const openPanel = (mode: "signin" | "signup") => {
    setShowSignupOtpInput(false);
    setOtp("");
    setShowPassword(false);
    setAuthPanel(mode);
  };

  const closePanel = () => {
    setShowSignupOtpInput(false);
    setOtp("");
    setShowPassword(false);
    setAuthPanel(null);
  };

  // ✅ API URL FROM ENV
  const API_URL = API_BASE_URL;

  const redirectAfterStudentLogin = async (token: string) => {
    if (shareCourseId) {
      const dest = await resolveStudentCoursePath(shareCourseId, token);
      navigate(dest, { replace: true });
      return;
    }
    navigate(getHomePath(ROLE_STUDENT), { replace: true });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const triggerToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000); };
  const getRecaptchaContainerId = () => (isSignUp ? "recaptcha-container-signup" : "recaptcha-container-signin");

  const ensureRecaptcha = async () => {
    const targetId = getRecaptchaContainerId();

    if (window.recaptchaVerifier) {
      if (window.recaptchaContainerId === targetId) {
        // Reuse existing widget as-is. Do not reset here, otherwise user
        // is forced to solve captcha again right after clicking Get OTP.
        return window.recaptchaVerifier;
      }
      try { window.recaptchaVerifier.clear(); } catch { }
      window.recaptchaVerifier = null;
      window.recaptchaWidgetId = undefined;
      window.recaptchaContainerId = undefined;
    }
    try {
      const container = document.getElementById(targetId);
      if (!container) return null;
      container.innerHTML = "";

      const auth = getFirebaseAuthSafe();
      if (!auth) {
        console.warn("Firebase auth unavailable — skipping reCAPTCHA.");
        return null;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, targetId, {
        size: "normal",
        callback: () => {
          setIsCaptchaSolved(true);
          console.log("Captcha Verified");
        },
        'expired-callback': () => {
          setIsCaptchaSolved(false);
          triggerToast("Captcha expired. Please solve it again.", "error");
        }
      });
      window.recaptchaWidgetId = await window.recaptchaVerifier.render();
      window.recaptchaContainerId = targetId;
      return window.recaptchaVerifier;
    } catch (err) {
      console.error("Recaptcha Init Error:", err);
      return null;
    }
  };

  useEffect(() => {
    setShowSignupOtpInput(false);
    setOtp("");
    setConfirmationResult(null);
    setIsCaptchaSolved(false);
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch { }
      window.recaptchaVerifier = null;
    }
    window.recaptchaWidgetId = undefined;
    window.recaptchaContainerId = undefined;

    const signInContainer = document.getElementById("recaptcha-container-signin");
    if (signInContainer) signInContainer.innerHTML = "";
    const signUpContainer = document.getElementById("recaptcha-container-signup");
    if (signUpContainer) signUpContainer.innerHTML = "";
    if (isSignUp) void ensureRecaptcha();
  }, [isSignUp]);

  // Signup OTP (falls back to direct account create when Firebase is not set up)
  const sendSignupOtp = async () => {
    if (!phone || phone.length < 10) return triggerToast("Please enter a valid phone number", "error");

    if (!FIREBASE_CONFIGURED) {
      setLoading(true);
      try {
        await finalizeSignup();
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    // Auto-add +91 if user didn't type country code
    const phoneNumber = phone.startsWith("+") ? phone : "+91" + phone;

    try {
      const appVerifier = await ensureRecaptcha();
      if (!appVerifier) {
        setLoading(false);
        triggerToast("Captcha init failed. Refresh and try again.", "error");
        return;
      }
      if (!isCaptchaSolved) {
        setLoading(false);
        triggerToast("Please complete CAPTCHA before sending OTP.", "error");
        return;
      }

      const auth = getFirebaseAuthSafe();
      if (!auth) {
        throw new Error("Firebase auth unavailable");
      }
      const confirmation = await Promise.race([
        signInWithPhoneNumber(auth, phoneNumber, appVerifier),
        new Promise((_, reject) => setTimeout(() => reject(new Error("OTP request timeout")), 30000))
      ]) as any;

      // Save result
      setConfirmationResult(confirmation);
      (window as any).confirmationResult = confirmation;

      setLoading(false);
      setShowSignupOtpInput(true);
      triggerToast("OTP sent successfully.", "success");

    } catch (error: any) {
      console.error("SMS Error:", error);
      setLoading(false);

      // Reset Captcha so they can try again
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch { }
        window.recaptchaVerifier = null;
      }
      setIsCaptchaSolved(false);
      const container = document.getElementById(getRecaptchaContainerId());
      if (container) container.innerHTML = "";

      if (error.code === 'auth/invalid-phone-number') {
        triggerToast("Invalid Phone Number Format.", "error");
      } else if (error.code === 'auth/argument-error' || error.code === "auth/invalid-app-credential") {
        // OTP provider unavailable — create account without phone verification
        console.warn("Phone OTP unavailable, creating account directly.", error);
        await finalizeSignup();
      } else if (error.code === 'auth/too-many-requests' || error.code === 'auth/quota-exceeded') {
        triggerToast("Too many OTP attempts. Please try again later.", "error");
      } else {
        triggerToast("Could not send OTP. Please try again.", "error");
      }
    }
  };

  const verifySignupOtp = async () => {
    if (!otp) return;

    setLoading(true);

    // Safety check to ensure the SMS was actually sent
    if (!confirmationResult) {
      triggerToast("Session expired. Please request a new OTP.", "error");
      setLoading(false);
      return;
    }

    confirmationResult.confirm(otp).then(async () => {
      setLoading(false);
      triggerToast("Phone Verified!", "success");
      await finalizeSignup();
    }).catch((error: any) => {
      setLoading(false);
      console.error("Verification Error:", error);
      triggerToast("Invalid OTP. Please try again.", "error");
    });
  };
  // Final account creation after OTP verification
  const finalizeSignup = async () => {
    try {
      await axios.post(`${API_URL}/users`, {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: role,
        phone_number: phone
      });
      triggerToast("Account created successfully! Please Sign In.", "success");

      // Reset Everything & Go to Login View
      setShowSignupOtpInput(false);
      setOtp("");
      setPhone("");
      setConfirmationResult(null);
      setAuthPanel("signin");
    } catch (err: any) {
      triggerToast(err.response?.data?.detail || "Registration Failed. Email may exist.", "error");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Login is email + password only
    if (!isSignUp) {
      setLoading(true);
      try {
        const loginParams = new URLSearchParams();
        loginParams.append("username", formData.email);
        loginParams.append("password", formData.password);

        const res = await axios.post(`${API_URL}/login`, loginParams);

        if (res.data.role !== ROLE_STUDENT) {
          triggerToast("This portal is for students. Use Admin Access for instructors.", "error");
          setLoading(false);
          return;
        }
        saveSession(res.data.access_token, ROLE_STUDENT);
        triggerToast("Login Successful! Redirecting...", "success");
        setTimeout(() => {
          void redirectAfterStudentLogin(res.data.access_token);
        }, 600);
      } catch (err: any) {
        triggerToast(err.response?.data?.detail || "Authentication failed. Check credentials.", "error");
      } finally {
        setLoading(false);
      }
    }
    // Signup uses OTP
    else {
      if (!showSignupOtpInput) {
        await sendSignupOtp();
      } else {
        await verifySignupOtp();
      }
    }
  };

  const chooserContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };

  const chooserItem = {
    hidden: { opacity: 0, y: 28, scale: 0.94 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 260, damping: 22 },
    },
  };

  return (
    <div className="auth-canvas">
      <TechAuthBackground />

      <button
        onClick={() => navigate("/admin-login")}
        className="btn-ghost-pill absolute top-4 right-4 z-40 lg:top-6 lg:right-6"
      >
        <ShieldCheck size={16} className="lg:h-[18px] lg:w-[18px]" /> Admin Access
      </button>

      {/* Student login chooser — logo only here (not on Sign In / Create Account sheets) */}
      {!authPanel && (
        <motion.div
          variants={chooserContainer}
          initial="hidden"
          animate="show"
          className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center"
        >
          <motion.div variants={chooserItem} className="mb-6">
            <BrandLogo size="xl" showTagline />
          </motion.div>

          <motion.h1
            variants={chooserItem}
            className="mb-2 text-3xl font-extrabold tracking-tight text-iqSlate sm:text-4xl"
          >
            Welcome, Learner
          </motion.h1>
          <motion.p variants={chooserItem} className="mb-10 max-w-sm text-sm text-slate-500">
            Sign in to continue learning, or create a new account to get started.
          </motion.p>

          <motion.div
            variants={chooserItem}
            className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5"
          >
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openPanel("signin")}
              className="auth-choice-card group border-iqBlue/25 hover:border-iqBlue/50 hover:bg-iqBlueLight/50 hover:shadow-lift"
            >
              <span className="relative mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-iqBlue/15 to-iqBlue/5 text-iqBlue shadow-inner ring-1 ring-iqBlue/20 transition-all duration-300 ease-out group-hover:scale-105 group-hover:from-iqBlue group-hover:to-iqBlueDark group-hover:text-white group-hover:ring-iqBlue/40">
                <span className="absolute inset-0 rounded-2xl bg-iqBlue/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                <LogIn className="relative" size={30} strokeWidth={1.75} />
              </span>
              <span className="text-lg font-extrabold text-iqSlate">Sign In</span>
              <span className="text-xs text-slate-400">Access your learning hub</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-iqBlue opacity-0 transition-opacity group-hover:opacity-100">
                Continue <ArrowRight size={12} />
              </span>
            </motion.button>

            <motion.button
              type="button"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openPanel("signup")}
              className="auth-choice-card group border-iqGreen/30 hover:border-iqGreen/55 hover:bg-iqGreenLight/60 hover:shadow-lift"
            >
              <span className="relative mb-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-iqGreen/20 to-iqGreen/5 text-iqGreen shadow-inner ring-1 ring-iqGreen/25 transition-all duration-300 ease-out group-hover:scale-105 group-hover:from-iqGreen group-hover:to-iqGreenDark group-hover:text-white group-hover:ring-iqGreen/45">
                <span className="absolute inset-0 rounded-2xl bg-iqGreen/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                <UserPlus className="relative" size={30} strokeWidth={1.75} />
              </span>
              <span className="text-lg font-extrabold text-iqSlate">Create New Account</span>
              <span className="text-xs text-slate-400">Start your IQMath journey</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-iqGreen opacity-0 transition-opacity group-hover:opacity-100">
                Join now <ArrowRight size={12} />
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Fullscreen auth sheet — pops in from center */}
      <AnimatePresence>
        {authPanel && (
          <motion.div
            key="auth-sheet"
            className="fixed inset-0 z-50 flex flex-col bg-white"
            initial={{ opacity: 0, scale: 0.82, y: 40, borderRadius: 56 }}
            animate={{ opacity: 1, scale: 1, y: 0, borderRadius: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24, borderRadius: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 26, mass: 0.9 }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className={`absolute -left-[10%] -top-[15%] h-[40%] w-[40%] rounded-full blur-[90px] ${
                  isSignUp ? "bg-iqGreen/15" : "bg-iqBlue/15"
                }`}
              />
              <div
                className={`absolute -bottom-[12%] -right-[8%] h-[40%] w-[40%] rounded-full blur-[100px] ${
                  isSignUp ? "bg-iqBlue/10" : "bg-iqGreen/15"
                }`}
              />
            </div>

            <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
              <BrandLogo size="md" />
              <button
                type="button"
                onClick={closePanel}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-10">
              <AnimatePresence mode="wait">
                {authPanel === "signin" ? (
                  <motion.form
                    key="signin-form"
                    onSubmit={handleAuth}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                    className="flex w-full max-w-[380px] flex-col items-center text-center"
                  >
                    <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-iqSlate sm:text-3xl">
                      Learner Login
                    </h1>
                    <p className="mb-8 text-sm text-slate-400">Sign in using email and password</p>

                    <div className="w-full space-y-4">
                      <div className="input-shell">
                        <Mail className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email Address"
                          required
                          className="input-field"
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="input-shell">
                        <Lock className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="Password"
                          required
                          className="input-field"
                          onChange={handleInputChange}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="ml-2 shrink-0 text-slate-400 transition-colors hover:text-iqBlue focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className={`${activeBtn} mt-6 w-full py-3.5`}>
                      {loading ? "Signing In..." : "Sign In"} <ArrowRight size={18} />
                    </button>

                    <p className="mt-8 text-sm text-slate-500">
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => openPanel("signup")}
                        className="font-bold text-iqBlue hover:underline"
                      >
                        Create New Account
                      </button>
                    </p>
                  </motion.form>
                ) : !showSignupOtpInput ? (
                  <motion.form
                    key="signup-form"
                    onSubmit={handleAuth}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                    className="flex w-full max-w-[380px] flex-col items-center text-center"
                  >
                    <h1 className={`mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${activeText}`}>
                      Create Account
                    </h1>
                    <p className="mb-6 text-sm text-slate-400">
                      {FIREBASE_CONFIGURED
                        ? "Enter details to verify & join"
                        : "Enter your details to create an account"}
                    </p>

                    <div className="w-full space-y-4">
                      <div className="input-shell-accent">
                        <User className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type="text"
                          name="name"
                          placeholder="Full Name"
                          required
                          className="input-field"
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="input-shell-accent">
                        <Mail className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email Address"
                          required
                          className="input-field"
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="input-shell-accent">
                        <Lock className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="Create Password"
                          required
                          className="input-field"
                          onChange={handleInputChange}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="ml-2 shrink-0 text-slate-400 transition-colors hover:text-iqGreen focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <div className="input-shell-accent">
                        <Smartphone className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
                        <input
                          type="tel"
                          value={phone}
                          placeholder="Phone (e.g. 9999999999)"
                          required
                          className="input-field"
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    {FIREBASE_CONFIGURED && (
                      <div className="mt-4 flex w-full justify-center">
                        <div id="recaptcha-container-signup" />
                      </div>
                    )}

                    <button type="submit" disabled={loading} className={`${activeBtn} mt-6 w-full py-3.5`}>
                      {FIREBASE_CONFIGURED
                        ? (loading ? "Sending OTP..." : "Get OTP & Sign Up")
                        : (loading ? "Creating Account..." : "Create Account")}{" "}
                      <CheckCircle size={18} />
                    </button>
                    {FIREBASE_CONFIGURED && !isCaptchaSolved && (
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        Complete CAPTCHA, then click Get OTP.
                      </p>
                    )}

                    <p className="mt-8 text-sm text-slate-500">
                      Already a member?{" "}
                      <button
                        type="button"
                        onClick={() => openPanel("signin")}
                        className="font-bold text-iqBlue hover:underline"
                      >
                        Sign In
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.div
                    key="otp-form"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                    className="flex w-full max-w-[320px] flex-col items-center text-center"
                  >
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-iqGreen/15">
                      <MessageSquare className="text-iqGreen" size={32} />
                    </div>
                    <h2 className="mb-2 text-2xl font-extrabold text-slate-800">Verify OTP</h2>
                    <p className="mb-6 text-sm text-slate-500">
                      Enter the 6-digit code sent to {phone}
                    </p>

                    <div className="mb-6 w-full max-w-[250px]">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full border-b-2 border-slate-300 bg-transparent py-3 text-center text-3xl font-bold tracking-widest outline-none focus:border-iqGreen"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={verifySignupOtp}
                      disabled={loading}
                      className={`${activeBtn} w-full max-w-[250px] py-3.5`}
                    >
                      {loading ? "Verifying..." : "Verify & Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSignupOtpInput(false)}
                      className="mt-4 text-xs font-bold text-slate-400 hover:underline"
                    >
                      Change Number
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast.show && (
        <div
          className="fixed top-5 right-5 z-[60] flex animate-fade-in items-center gap-3 rounded-xl border border-slate-100 bg-white px-6 py-4 shadow-lift"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: toast.type === "success" ? "#8DC63F" : "#ef4444",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle className="text-iqGreen" size={24} />
          ) : (
            <AlertCircle className="text-red-500" size={24} />
          )}
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {toast.type === "success" ? "Success" : "Error"}
            </h4>
            <p className="text-xs text-slate-500">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast({ ...toast, show: false })}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Login;