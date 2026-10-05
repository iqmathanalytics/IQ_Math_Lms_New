import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight, CheckCircle, GraduationCap, AlertCircle, X, Eye, EyeOff, Facebook, Github, Linkedin } from "lucide-react";
import API_BASE_URL from './config';
import BrandLogo from "./components/BrandLogo";
import { getHomePath, ROLE_INSTRUCTOR, saveSession } from "./utils/session";
// Google Icon
const GoogleIcon = () => (<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);

interface ToastState { show: boolean; message: string; type: "success" | "error"; }

const AdminLogin = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-iqBlue to-iqGreen";

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
      triggerToast("Welcome back, Instructor!", "success");
      setTimeout(() => navigate(getHomePath(ROLE_INSTRUCTOR), { replace: true }), 600);
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] animate-float-slow rounded-full bg-iqBlue/15 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] animate-float-slower rounded-full bg-iqGreen/20 blur-[100px]" />
      </div>

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

          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-iqSlate">Instructor Access</h1>
          <p className="mb-6 px-4 text-sm text-iqMuted">Secure login for faculty and administration.</p>

          <div className="mb-6 flex w-full justify-center gap-4">
            <button type="button" className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition-all hover:border-iqBlue/30 hover:bg-iqBlueLight"><GoogleIcon /></button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white p-2.5 text-[#1877F2] shadow-sm transition-all hover:bg-iqBlueLight"><Facebook size={20} fill="currentColor" strokeWidth={0} /></button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 shadow-sm transition-all hover:bg-iqBlueLight"><Github size={20} /></button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white p-2.5 text-[#0A66C2] shadow-sm transition-all hover:bg-iqBlueLight"><Linkedin size={20} fill="currentColor" strokeWidth={0} /></button>
          </div>

          <div className="mb-6 flex w-full items-center">
            <div className="h-px flex-1 bg-slate-200"></div>
            <span className="px-3 text-xs font-medium text-slate-400">OR USE EMAIL</span>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>

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
