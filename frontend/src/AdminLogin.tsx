import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight, CheckCircle, GraduationCap, AlertCircle, X, Eye, EyeOff } from "lucide-react";
import API_BASE_URL from './config';
import BrandLogo from "./components/BrandLogo";
import TechAuthBackground from "./components/TechAuthBackground";
import { getHomePath, ROLE_INSTRUCTOR, saveSession } from "./utils/session";

interface ToastState { show: boolean; message: string; type: "success" | "error"; }

const AdminLogin = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-iqBlue to-iqGreen";

  // Warm Render while admin types credentials
  useEffect(() => {
    const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    fetch(`${origin}/health`, { mode: "cors", cache: "no-store" }).catch(() => {});
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginParams = new URLSearchParams();
      loginParams.append("username", formData.email);
      loginParams.append("password", formData.password);

      const res = await axios.post(`${API_BASE_URL}/login`, loginParams);

      if (res.data.role !== ROLE_INSTRUCTOR) {
        triggerToast("Access Denied. Use the Learner Portal for student login.", "error");
        setLoading(false);
        return;
      }
      saveSession(res.data.access_token, ROLE_INSTRUCTOR);
      triggerToast("Welcome back!", "success");
      navigate(getHomePath(ROLE_INSTRUCTOR), { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (!err?.response) {
        triggerToast("Backend unreachable. Ensure API is running.", "error");
      } else {
        triggerToast(detail || "Authentication failed. Check credentials.", "error");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-canvas">
      <TechAuthBackground />

      <button onClick={() => navigate("/login")} className="btn-ghost-pill absolute top-4 right-4 z-50 lg:top-6 lg:right-6">
        <GraduationCap size={16} className="lg:h-[18px] lg:w-[18px]" /> Learner Portal
      </button>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="auth-card w-full max-w-[450px] bg-surfaceMuted/95 p-6 lg:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="mb-4"
          >
            <BrandLogo size="lg" showTagline />
          </motion.div>

          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-iqSlate">Administration</h1>
          <p className="mb-8 px-4 text-sm text-iqMuted">Secure login for faculty and administration.</p>

          <form onSubmit={handleAuth} className="w-full space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="input-shell"
            >
              <Mail className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
              <input type="email" name="email" placeholder="Instructor Email" required className="input-field" onChange={handleInputChange} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="input-shell"
            >
              <Lock className="mr-3 shrink-0 text-slate-400" size={20} strokeWidth={1.5} />
              <input
                type={showPassword ? "text" : "password"}
                name="password" placeholder="Password" required
                className="input-field"
                onChange={handleInputChange}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 shrink-0 text-slate-400 transition-colors hover:text-iqBlue focus:outline-none">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </motion.div>

            <button type="submit" disabled={loading} className="btn-primary mt-4 w-full bg-gradient-to-r from-iqBlue to-iqGreen py-3.5 hover:opacity-95 hover:bg-gradient-to-r">
              {loading ? "Verifying..." : "Access Dashboard"} <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8 w-full border-t border-slate-200 pt-6">
            <p className="text-xs font-medium text-slate-400">Need an account? Contact the <span className={`cursor-pointer font-bold hover:underline ${gradientText}`}>University IT Admin</span>.</p>
          </div>
        </div>
      </motion.div>

      {toast.show && (
        <div className="fixed top-5 right-5 z-50 flex animate-fade-in items-center gap-3 rounded-xl border border-slate-100 bg-white px-6 py-4 shadow-lift" style={{ borderLeftWidth: 4, borderLeftColor: toast.type === "success" ? "#8DC63F" : "#ef4444" }}>
          {toast.type === "success" ? <CheckCircle className="text-iqGreen" size={24} /> : <AlertCircle className="text-red-500" size={24} />}
          <div>
            <h4 className="text-sm font-bold text-slate-800">{toast.type === "success" ? "Success" : "Error"}</h4>
            <p className="text-xs text-slate-500">{toast.message}</p>
          </div>
          <button onClick={() => setToast({ ...toast, show: false })} className="ml-2 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default AdminLogin;
