import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import API_BASE_URL from './config';
import { runTestCasesLocally } from './utils/pyodideEnv';
import {
    LayoutDashboard, BookOpen, Compass, Award, LogOut,
    CheckCircle, AlertTriangle, X,
    Code, Play, Monitor, ChevronRight, Cloud,
    Menu, Sparkles, Zap, User, PlayCircle, Trophy, Lock, BellRing, Trash2, Settings, Download, Clock
} from "lucide-react";
import { motion } from "framer-motion";

// ✅ AI IMPORTS 
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";

import "@tensorflow/tfjs-backend-webgl";
import FastImage from "./components/FastImage";
import { CODE_TEMPLATES } from './utils/codeTemplates';
import BrandLogo from "./components/BrandLogo";
import { authHeaders, clearSession, getHomePath, getValidSession, ROLE_INSTRUCTOR } from "./utils/session";
import { prefetchImages } from "./utils/imageUrl";

// --- TYPES ---
interface Course {
    id: number;
    title: string;
    description: string;
    price: number;
    image_url: string;
    instructor_id: number;
    // ✅ Updated Fields
    course_type?: string; // "standard" | "coding"
    enrollment_type?: "paid" | "trial";
    days_left?: number;
    is_trial_expired?: boolean;
    has_certificate?: boolean;
}

interface CodeTest { id: number; title: string; time_limit: number; problems: any[]; completed?: boolean; }

// --- RAZORPAY SCRIPT LOADER ---
const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// --- 🟢 HELPER COMPONENTS ---

const NavItem = ({ icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 ${active
            ? "bg-iqBlueLight text-iqBlue shadow-soft"
            : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
            }`}
    >
        {icon} {label}
    </button>
);

const StatCard = ({ icon: Icon, label, value, delay = 0 }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        whileHover={{ y: -5 }}
        className="kpi-card group"
    >
        <div className="rounded-2xl bg-gradient-to-br from-iqBlueLight to-white p-3.5 text-iqBlue shadow-soft ring-1 ring-iqBlue/10 transition-colors group-hover:from-iqBlue group-hover:to-iqBlueDark group-hover:text-white">
            <Icon size={24} />
        </div>
        <div>
            <h4 className="text-3xl font-extrabold tracking-tight text-slate-800">{value}</h4>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        </div>
    </motion.div>
);

const CourseCard = ({ course, type, navigate, handleFreeEnroll, openEnrollModal, handleDownloadSyllabus, onPayClick }: any) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="course-card-shell group"
        >
            {/* ✅ 1. COMPLETED RIBBON */}
            {course.has_certificate && (
                <div className="absolute top-4 -right-12 z-20 rotate-45 bg-amber-300 px-12 py-1 text-[10px] font-extrabold text-amber-900 shadow-md">
                    COMPLETED
                </div>
            )}

            <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-iqBlueLight/40">
                {course.image_url ? (
                    <FastImage
                        src={course.image_url}
                        alt={course.title}
                        widthHint={480}
                        className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        skeletonClassName="h-44 w-full"
                    />
                ) : (
                    <BookOpen size={40} className="text-slate-400" />
                )}

                {/* Status Badges */}
                {type === "enrolled" && (
                    <div className="absolute top-2 left-2 flex gap-2">
                        {course.enrollment_type === "paid" ? (
                            <div className="flex items-center gap-1 rounded-full bg-iqGreen px-2.5 py-1 text-[10px] font-bold text-white shadow-soft">
                                <CheckCircle size={10} /> PAID
                            </div>
                        ) : (
                            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-soft ${course.is_trial_expired ? "bg-red-500" : "bg-orange-500"}`}>
                                <Clock size={10} /> {course.is_trial_expired ? "TRIAL ENDED" : `${course.days_left} DAYS LEFT`}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-5">
                <h4 className="mb-4 truncate font-bold text-slate-800" title={course.title}>{course.title}</h4>

                <div className="flex items-center justify-between">
                    {/* ✅ 2. DYNAMIC PRICE / STATUS DISPLAY */}
                    {type === "enrolled" ? (
                        <div className="flex items-center gap-2">
                            {course.enrollment_type === "trial" ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPayClick(course); }}
                                    className="animate-pulse rounded-lg border border-iqGreen/30 bg-iqGreen/10 px-3 py-1.5 text-xs font-bold text-iqGreenDark transition-colors hover:bg-iqGreen/20"
                                >
                                    Pay ₹{course.price}
                                </button>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">Lifetime Access</span>
                            )}
                        </div>
                    ) : (
                        <span className={`text-lg font-extrabold ${course.price === 0 ? "text-iqGreen" : "text-iqBlue"}`}>
                            {course.price === 0 ? "Free" : `₹${course.price}`}
                        </span>
                    )}

                    {/* ✅ 3. ACTION BUTTONS */}
                    {type === "available" ? (
                        <button
                            onClick={() => course.price === 0 ? handleFreeEnroll(course.id) : openEnrollModal(course)}
                            className={course.price === 0 ? "btn-accent px-4 py-2" : "btn-primary px-4 py-2"}
                        >
                            {course.price === 0 ? <Sparkles size={14} /> : <Lock size={14} />} {course.price === 0 ? "Enroll" : "Unlock"}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDownloadSyllabus(course.description); }}
                                className="btn-secondary p-2"
                                title="Download Syllabus"
                            >
                                <Download size={16} />
                            </button>

                            <button
                                onClick={() => navigate(`/course/${course.id}/player`)}
                                disabled={course.is_trial_expired}
                                className="btn-dark px-4 py-2"
                            >
                                <PlayCircle size={14} /> {course.is_trial_expired ? "Locked" : "Resume"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// --- 🔄 POLL RESULT HELPER (Added Globally) ---
// --- POLLING HELPER REMOVED (Lambda is sync) ---

// --- 🔵 MAIN COMPONENT ---

const StudentDashboard = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const deepLinkCourseId = searchParams.get("course");
    const deepLinkTab = searchParams.get("tab");
    const RAZORPAY_PAYLINK_URL = import.meta.env.VITE_RAZORPAY_PAYLINK_URL;
    const [activeTab, setActiveTab] = useState(() => {
        if (deepLinkTab === "explore" || deepLinkTab === "learning" || deepLinkTab === "home") return deepLinkTab;
        if (deepLinkCourseId) return "explore";
        return "home";
    });
    const [highlightCourseId, setHighlightCourseId] = useState<number | null>(
        deepLinkCourseId ? Number(deepLinkCourseId) : null
    );

    // ✅ NEW: Sub-tab for My Learning (Standard vs Coding)
    const [learningSubTab, setLearningSubTab] = useState("standard");

    const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [progressMap, setProgressMap] = useState<{ [key: number]: { percent: number, completed: number, total: number } }>({});
    const [collapsed, setCollapsed] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [studentProfile, setStudentProfile] = useState({ name: "Loading...", email: "..." });
    const [newPassword, setNewPassword] = useState("");
    // ✅ MOVED: Mobile Menu State (Must be before conditional returns)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    // Modal & Settings
    const [showModal, setShowModal] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [promoCode, setPromoCode] = useState("");
    const [promoInfo, setPromoInfo] = useState<{ final_price: number; original_price: number; message: string; code: string } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
        show: false, message: "", type: "success"
    });

    // --- CODE ARENA STATES ---
    const [codeTests, setCodeTests] = useState<CodeTest[]>([]);
    const [activeTest, setActiveTest] = useState<CodeTest | null>(null);
    const [passKeyInput, setPassKeyInput] = useState("");
    const [showPassKeyModal, setShowPassKeyModal] = useState<number | null>(null);

    // --- 🛡️ PROCTORING STATES ---
    const [, setTimeLeft] = useState(0);
    const [warnings, setWarnings] = useState(0);
    const [faceStatus, setFaceStatus] = useState<"ok" | "missing" | "multiple">("ok");
    const [isFullScreenViolation, setIsFullScreenViolation] = useState(false);

    // Problem & Code State
    const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
    const [solutions, setSolutions] = useState<{ [key: number]: string }>({});
    const [userCode, setUserCode] = useState(CODE_TEMPLATES.python);
    const [language, setLanguage] = useState(71);

    const [consoleOutput, setConsoleOutput] = useState("Ready to execute...");
    const [executionStatus, setExecutionStatus] = useState("idle");
    // ✅ NEW: Strict "Unlock Submit" State
    const [canSubmit, setCanSubmit] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);

    // 🎨 PROFESSIONAL THEME PALETTE
    const brand = {
        iqBlue: "#0088C7", iqGreen: "#8DC63F", mainBg: "#F5F9FF", cardBg: "#FFFFFF", border: "#cbd5e1", textMain: "#1E293B", textLight: "#64748B"
    };

    const languages = [
        { id: 71, name: "Python (3.8.1)", value: "python" },
        { id: 62, name: "Java (OpenJDK 13)", value: "java" },
        { id: 54, name: "C++ (GCC 9.2.0)", value: "cpp" },
        { id: 63, name: "JavaScript (Node.js)", value: "javascript" },
    ];

    // ✅ Toast Helper
    const triggerToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };
    const isNetworkError = (err: any) =>
        !err?.response && (err?.code === "ERR_NETWORK" || err?.message === "Network Error");

    const getErrorMessage = (err: any, fallback: string) => {
        if (isNetworkError(err)) {
            return "Backend offline. Start the API on port 8000 and try again.";
        }
        const detail = err?.response?.data?.detail;
        if (typeof detail === "string") return detail;
        return err?.response?.data?.message || err?.message || fallback;
    };

    // ✅ INITIAL FETCH WITH SAFETY CHECKS
    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/users/me`, { headers: authHeaders() });
            setStudentProfile({
                name: res.data.full_name,
                email: res.data.email
            });
        } catch (e: any) {
            if (!isNetworkError(e)) console.error("Profile fetch error", e);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/notifications`, { headers: authHeaders() });
            setNotifications(res.data);
            setUnreadCount(res.data.filter((n: any) => !n.is_read).length);
        } catch (e: any) {
            if (!isNetworkError(e)) console.error("Notif error", e);
        }
    };

    useEffect(() => {
        // Poll every 30s
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (attempt = 0) => {
        setLoading(true);
        try {
            const session = getValidSession();
            if (!session) { navigate("/login", { replace: true }); return; }
            if (session.role === ROLE_INSTRUCTOR) {
                navigate(getHomePath(ROLE_INSTRUCTOR), { replace: true });
                return;
            }

            const config = { headers: authHeaders() };

            const [allRes, myRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/courses`, config),
                axios.get(`${API_BASE_URL}/my-courses`, config)
            ]);

            // SAFETY CHECK: Ensure we have arrays
            const allData = Array.isArray(allRes.data) ? allRes.data : [];
            const myData = Array.isArray(myRes.data) ? myRes.data : [];

            const myCourseIds = new Set(myData.map((c: any) => c.id));
            const available = allData.filter((c: any) => !myCourseIds.has(c.id));
            setAvailableCourses(available);
            setEnrolledCourses(myData);
            // Warm course thumbnails in the background so cards appear instantly
            prefetchImages(
                [...myData, ...available].map((c: any) => c.image_url),
                480
            );

            // Deep-link from share page: enrolled → learning (+ open player), else explore
            if (deepLinkCourseId) {
                const cid = Number(deepLinkCourseId);
                setHighlightCourseId(cid);
                if (myCourseIds.has(cid)) {
                    setActiveTab("learning");
                    navigate(`/course/${cid}/player`, { replace: true });
                } else {
                    setActiveTab(deepLinkTab === "learning" ? "learning" : "explore");
                }
            } else if (deepLinkTab === "explore" || deepLinkTab === "learning") {
                setActiveTab(deepLinkTab);
            }
        } catch (err: any) {
            if (err.response?.status === 401) { clearSession(); navigate("/login", { replace: true }); return; }
            if (isNetworkError(err) && attempt < 2) {
                await new Promise((r) => setTimeout(r, 1200));
                return fetchData(attempt + 1);
            }
            if (isNetworkError(err)) {
                triggerToast("Backend offline — start API on port 8000, then refresh.", "error");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!newPassword) return triggerToast("Please enter a new password", "error");

        try {
            await axios.post(`${API_BASE_URL}/user/change-password`,
                { new_password: newPassword },
                { headers: authHeaders() }
            );
            triggerToast("Password Updated Successfully!", "success");
            setNewPassword(""); // ✅ This uses the setter, fixing your error!
        } catch (err) {
            triggerToast("Failed to update password", "error");
        }
    };

    const fetchCodeTests = async () => {
        try {
            if (!getValidSession()) return;
            const res = await axios.get(`${API_BASE_URL}/code-tests`, { headers: authHeaders() });
            setCodeTests(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
            if (!isNetworkError(err)) console.error(err);
        }
    };

    useEffect(() => {
        const session = getValidSession();
        if (!session) { navigate("/login", { replace: true }); return; }
        if (session.role === ROLE_INSTRUCTOR) {
            navigate(getHomePath(ROLE_INSTRUCTOR), { replace: true });
            return;
        }
        fetchData();
        fetchCodeTests();
        fetchProfile();
    }, []);

    useEffect(() => {
        if (enrolledCourses.length > 0) {
            enrolledCourses.forEach(course => {
                fetchCourseProgress(course.id);
            });
        }
    }, [enrolledCourses]);

    useEffect(() => {
        if (!highlightCourseId || activeTab !== "explore" || loading) return;
        const el = document.getElementById(`course-card-${highlightCourseId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [highlightCourseId, activeTab, loading, availableCourses]);

    const fetchCourseProgress = async (courseId: number) => {
        try {
                        const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/player`, {
                headers: authHeaders()
            });
            const modules = res.data?.modules || [];

            // Count items that are explicitly completed OR marked complete by instructor
            const completed = modules.reduce((acc: number, m: any) => acc + m.lessons.filter((l: any) => l.is_completed).length, 0);

            // Calculate total lessons count, not just modules
            const totalLessons = modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);

            const percent = totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100);

            // Save to map using Course ID as key
            setProgressMap(prev => ({
                ...prev,
                [courseId]: { percent, completed, total: totalLessons }
            }));
        } catch (err) { console.error("Failed to fetch progress", err); }
    };

    // 🛡️ MILITARY GRADE PROCTORING LOGIC
    useEffect(() => {
        let aiInterval: any;
        if (activeTest) {
            const savedWarns = localStorage.getItem(`warns_${activeTest.id}`);
            if (savedWarns) setWarnings(parseInt(savedWarns));
            const savedSolutions = localStorage.getItem(`sols_${activeTest.id}`);
            if (savedSolutions) {
                const parsed = JSON.parse(savedSolutions);
                setSolutions(parsed);
                setUserCode(parsed[0] || CODE_TEMPLATES.python);
            } else setUserCode(CODE_TEMPLATES.python);

            const timer = setInterval(() => {
                setTimeLeft(prev => { if (prev <= 1) { submitTest(); return 0; } return prev - 1; });
            }, 1000);

            const triggerViolation = (type: string) => {
                const currentCount = parseInt(localStorage.getItem(`warns_${activeTest.id}`) || "0") + 1;
                localStorage.setItem(`warns_${activeTest.id}`, currentCount.toString());
                setWarnings(currentCount);

                if (currentCount > 2) {
                    submitTest(true);
                    triggerToast(`⛔ TEST TERMINATED: ${type}`, "error");
                }
            };

            const handleFullScreenChange = () => {
                if (!document.fullscreenElement) {
                    setIsFullScreenViolation(true);
                    triggerViolation("Full Screen Exited");
                } else {
                    setIsFullScreenViolation(false);
                }
            };

            const handleVisibilityChange = () => {
                if (document.hidden) triggerViolation("Tab Switch Detected");
            };

            document.addEventListener("fullscreenchange", handleFullScreenChange);
            document.addEventListener("visibilitychange", handleVisibilityChange);

            const setupAI = async () => {
                try {
                    await tf.setBackend('webgl');
                    const loadedModel = await blazeface.load();
                    if (navigator.mediaDevices.getUserMedia) {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                            videoRef.current.onloadeddata = () => {
                                aiInterval = setInterval(async () => {
                                    if (videoRef.current && videoRef.current.readyState === 4) {
                                        const predictions = await loadedModel.estimateFaces(videoRef.current, false);
                                        if (predictions.length === 0) setFaceStatus("missing");
                                        else if (predictions.length > 1) setFaceStatus("multiple");
                                        else setFaceStatus("ok");
                                    }
                                }, 1000);
                            };
                        }
                    }
                } catch (err) { }
            };
            setupAI();

            return () => {
                clearInterval(timer); clearInterval(aiInterval);
                document.removeEventListener("fullscreenchange", handleFullScreenChange);
                document.removeEventListener("visibilitychange", handleVisibilityChange);
                if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            };
        }
    }, [activeTest]);

    const handleStartTest = async () => {
                try {
            if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => { });
            const formData = new FormData(); formData.append("pass_key", passKeyInput);
            const res = await axios.post(`${API_BASE_URL}/code-tests/${showPassKeyModal}/start`, formData, { headers: authHeaders() });
            const prevWarns = localStorage.getItem(`warns_${res.data.id}`);
            if (prevWarns && parseInt(prevWarns) > 2) {
                if (document.fullscreenElement) document.exitFullscreen();
                triggerToast("Test Terminated Previously", "error"); return;
            }
            setActiveTest(res.data); setTimeLeft(res.data.time_limit * 60); setShowPassKeyModal(null); setWarnings(prevWarns ? parseInt(prevWarns) : 0);
        } catch (err) {
            if (document.fullscreenElement) document.exitFullscreen();
            triggerToast("Invalid Pass Key", "error");
        }
    };

    const returnToFullScreen = async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
                setIsFullScreenViolation(false);
            }
        } catch (e) { console.log(e); }
    };

    const handleSave = () => {
        if (!activeTest) return;
        const newSolutions = { ...solutions, [currentProblemIndex]: userCode };
        setSolutions(newSolutions);
        localStorage.setItem(`sols_${activeTest.id}`, JSON.stringify(newSolutions));
        triggerToast("✅ Code Saved!", "success");
    };

    // ✅ UPDATED EXECUTION LOGIC (Batch Mode)
    const handleRunCode = async () => {
        setExecutionStatus("running");
        setConsoleOutput("Processing...");
        setCanSubmit(false); // Reset permission

        const currentProb = activeTest?.problems[currentProblemIndex];
        let allCases: any[] = [];
        try {
            allCases = currentProb ? JSON.parse(currentProb.test_cases) : [];
        } catch (e) { allCases = []; }

        if (allCases.length === 0) {
            setConsoleOutput("⚠️ No test cases found.");
            setExecutionStatus("error");
            return;
        }

        // Dry-run uses only non-hidden cases (official grading still uses full suite on submit)
        const dryRunCases = allCases.filter((c) => !c.hidden);
        const casesForDryRun = dryRunCases.length > 0 ? dryRunCases : allCases;

        // 🟢 CASE 1: PYTHON (Run Locally with Strict Test Cases)
        if (language === 71) {
            setConsoleOutput("🔹 Running Local Tests (Pyodide)...");
            // Use the strict test runner
            const localRes = await runTestCasesLocally(userCode, casesForDryRun);

            if (localRes.success) {
                setExecutionStatus("success");
                setConsoleOutput(localRes.output); // Detailed output from runner
                triggerToast("All Local Tests Passed!", "success");
                setCanSubmit(true); // ✅ Unlock Submit
            } else {
                setExecutionStatus("error");
                setConsoleOutput(`❌ Execution Failed:\n${localRes.error || localRes.output}`);
                triggerToast("Tests Failed", "error");
            }
            return; // Stop here
        }

        if (!activeTest || !currentProb) {
            setExecutionStatus("error");
            setConsoleOutput("⚠️ Missing problem data.");
            return;
        }

        // 🔴 CASE 2: C++ / JAVA (Run on Server — dry run uses server-resolved public cases when possible)
        setConsoleOutput("🚀 specific language test on Server...");

        try {
            const res = await axios.post(`${API_BASE_URL}/execute`,
                {
                    source_code: userCode,
                    language_id: language,
                    test_cases: [],
                    code_test_id: activeTest.id,
                    problem_id: currentProb.id,
                    execution_mode: "dry_run",
                },
                { headers: authHeaders() }
            );

            const report = res.data;
            if (typeof report === "string") {
                setExecutionStatus("error");
                setConsoleOutput(`❌ Server Error:\n${report}`);
                return;
            }
            if (report.error) {
                setExecutionStatus("error");
                const hint = report.detail ? `\n\nDetail: ${report.detail}` : "";
                setConsoleOutput(`❌ Server Error: ${report.error}${hint}`);
                return;
            }

            // Check if passed/failed matching consistent strict logic
            const passed = report.stats?.passed ?? 0;
            const total = report.stats?.total ?? 0;

            if (total === 0) {
                setExecutionStatus("error");
                setConsoleOutput(
                    "❌ Compiler returned no usable test summary (0/0).\n\n" +
                    "Ensure your Lambda returns JSON with `results` and `stats` for each run."
                );
                return;
            }

            let outputStr = `✨ Dry Run Complete!\nPassed: ${passed}/${total}\nRuntime: ${report.stats?.runtime_ms ?? "—"}ms\n\n`;

            // Append Details
            (report.results || []).forEach((r: any) => {
                const idx = typeof r?.id === "number" ? r.id + 1 : "?";
                outputStr += `${r.status === "Passed" ? "✅" : "❌"} Case ${idx}: ${r.status}\n`;
                if (r.status !== "Passed") {
                    outputStr += `   Input: ${r.input ?? r.stdin}\n   Expected: ${r.expected ?? r.output}\n   Actual: ${r.actual}\n\n`;
                }
            });

            setConsoleOutput(outputStr);

            if (passed === total) {
                setExecutionStatus("success");
                triggerToast("All Tests Passed!", "success");
                setCanSubmit(true); // ✅ Unlock Submit
            } else {
                setExecutionStatus("error");
                triggerToast("Tests Failed", "error");
            }

        } catch (err: any) {
            setExecutionStatus("error");
            setConsoleOutput("❌ server error: " + (err.response?.data?.error || err.message));
        }
    };

    // ✅ NEW: SUBMIT FUNCTION (Official Grading)
    const handleSubmit = async () => {
        if (!canSubmit) {
            triggerToast("Please successfully RUN your code before submitting.", "error");
            return;
        }

        setExecutionStatus("running");
        setConsoleOutput("🚀 Submitting to Official Grader...");

        const currentProb = activeTest?.problems[currentProblemIndex];
        if (!activeTest || !currentProb) {
            triggerToast("No active problem.", "error");
            return;
        }

        try {
            // Grading uses canonical cases from the backend (includes hidden tests)
            const res = await axios.post(`${API_BASE_URL}/execute`,
                {
                    source_code: userCode,
                    language_id: language,
                    test_cases: [],
                    code_test_id: activeTest.id,
                    problem_id: currentProb.id,
                },
                { headers: authHeaders() }
            );

            const report = res.data;

            if (typeof report === "string") {
                setExecutionStatus("error");
                setConsoleOutput(`❌ SERVER ERROR:\n${report}`);
                triggerToast("Compiler returned invalid response", "error");
                return;
            }

            if (report.error) {
                setExecutionStatus("error");
                const hint = report.detail ? `\n\nDetail: ${report.detail}` : "";
                setConsoleOutput(`❌ SERVER ERROR:\n${report.error}${hint}`);
                triggerToast("Compiler error", "error");
                return;
            }

            // Check PASS/FAIL logic
            const passedCount = report.stats?.passed ?? 0;
            const totalCount = report.stats?.total ?? 0;

            if (totalCount === 0) {
                setExecutionStatus("error");
                setConsoleOutput(
                    "❌ The compiler did not report any test results (0/0).\n\n" +
                    "Your Lambda must return JSON like: { \"stats\": { \"passed\": n, \"total\": n, \"runtime_ms\": n }, \"results\": [ { \"input\", \"expected\", \"actual\", \"status\" } ] }.\n" +
                    "A plain string response (e.g. \"Hello from Lambda!\") will not work for Code Arena."
                );
                triggerToast("Invalid compiler response", "error");
                return;
            }

            // 🚨 STRICT SUCCESS VALIDATION
            if (passedCount === totalCount) {
                setExecutionStatus("success");
                setConsoleOutput(`🎉 Challenge Solved! All ${totalCount} test cases passed.\n\nRuntime: ${report.stats?.runtime_ms ?? "—"}ms`);
                triggerToast("🎉 Challenge Solved!", "success");

                // ✅ ONLY SAVE PROGRESS HERE
                handleSave();
            } else {
                setExecutionStatus("error");
                const fail = (report.results as any[])?.find((r: any) => r && r.status !== "Passed");
                const fin = fail?.input ?? fail?.stdin ?? "(hidden or n/a)";
                const fexp = fail?.expected ?? fail?.output ?? "(n/a)";
                const fact = fail?.actual ?? "(n/a)";
                setConsoleOutput(`❌ Test cases failed (${passedCount}/${totalCount} passed).\n\nFirst failure:\nInput: ${fin}\nExpected: ${fexp}\nActual: ${fact}`);
                triggerToast("Some tests failed", "error");
            }
        } catch (err: any) {
            setExecutionStatus("error");
            setConsoleOutput("❌ System Error: " + (err.response?.data?.error || err.message));
        }
    };


    const switchQuestion = (index: number) => {
        handleSave();
        setCanSubmit(false); // ✅ Reset permission on switch
        setCurrentProblemIndex(index);
        setUserCode(solutions[index] || CODE_TEMPLATES.python);
        setConsoleOutput("Ready...");
        setExecutionStatus("idle");
    };

    const submitTest = async (disqualified = false) => {
        if (!activeTest) return;
        try {
            await axios.post(`${API_BASE_URL}/code-tests/submit`, {
                test_id: activeTest.id, score: disqualified ? 0 : (executionStatus === "success" ? 100 : 40),
                problems_solved: Object.keys(solutions).length, time_taken: "Finished"
            }, { headers: authHeaders() });
            setActiveTest(null); localStorage.removeItem(`sols_${activeTest.id}`);
            if (document.fullscreenElement) document.exitFullscreen();
            triggerToast(disqualified ? "Test Terminated." : "Test Submitted Successfully!", disqualified ? "error" : "success");
        } catch (err) { }
    };

    const handleFreeEnroll = async (courseId: number) => {
        setProcessing(true);
        try {
            await axios.post(`${API_BASE_URL}/enroll/${courseId}`, { type: "paid" }, { headers: authHeaders() });
            triggerToast("🎉 Enrolled!", "success"); fetchData(); setActiveTab("learning");
        } catch (err) { triggerToast("Enrollment failed.", "error"); } finally { setProcessing(false); }
    };

    const applyPromo = async () => {
        if (!selectedCourse || !promoCode.trim()) return;
        try {
                        const res = await axios.post(
                `${API_BASE_URL}/promo/validate`,
                { code: promoCode.trim(), course_id: selectedCourse.id },
                { headers: authHeaders() }
            );
            setPromoInfo({
                final_price: res.data.final_price,
                original_price: res.data.original_price,
                message: res.data.message,
                code: res.data.code,
            });
            triggerToast(res.data.message || "Promo applied", "success");
        } catch (err: any) {
            setPromoInfo(null);
            triggerToast(getErrorMessage(err, "Invalid promo code"), "error");
        }
    };

    const handleEnrollStrategy = async (type: "trial" | "paid") => {
        if (!selectedCourse) return;
        setProcessing(true);

        try {
            if (type === "trial") {
                await axios.post(`${API_BASE_URL}/enroll/${selectedCourse.id}`,
                    { type: "trial" },
                    { headers: authHeaders() }
                );
                triggerToast(`🎉 Free Trial Started for ${selectedCourse.title}!`, "success");
                fetchData(); setShowModal(false); setActiveTab("learning");
            } else {
                                const orderRes = await axios.post(`${API_BASE_URL}/create-order`,
                    { course_id: selectedCourse.id, promo_code: promoInfo?.code || promoCode.trim() || undefined },
                    { headers: authHeaders() }
                );

                if (orderRes.data.free) {
                    triggerToast(orderRes.data.message || "Course unlocked with promo!", "success");
                    fetchData(); setShowModal(false); setPromoCode(""); setPromoInfo(null); setActiveTab("learning");
                    return;
                }

                const isLoaded = await loadRazorpayScript();
                if (!isLoaded) { triggerToast("SDK Failed to load", "error"); return; }
                const razorpayKey = orderRes.data.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
                if (!razorpayKey || String(razorpayKey).includes("replace_me")) {
                    triggerToast("Set a valid VITE_RAZORPAY_KEY_ID in frontend/.env", "error");
                    return;
                }

                const appliedPromo = orderRes.data.promo_code || promoInfo?.code || promoCode.trim() || undefined;
                const options = {
                    key: razorpayKey,
                    amount: orderRes.data.amount,
                    currency: orderRes.data.currency,
                    name: "iQmath Pro",
                    description: `Unlock ${selectedCourse.title}`,
                    order_id: orderRes.data.id,
                    handler: async function (response: any) {
                        await axios.post(
                            `${API_BASE_URL}/payment/verify`,
                            {
                                course_id: selectedCourse.id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                promo_code: appliedPromo,
                            },
                            { headers: authHeaders() }
                        );
                        triggerToast("🎉 Payment Successful! Course Unlocked.", "success");
                        fetchData(); setShowModal(false); setPromoCode(""); setPromoInfo(null); setActiveTab("learning");
                    },
                    prefill: { name: "Student", email: "student@iqmath.com" },
                    theme: { color: "#0088C7" },
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            }
        } catch (err: any) {
            triggerToast(getErrorMessage(err, "Transaction Failed."), "error");
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadCertificate = async (courseId: number, courseTitle: string) => {
        triggerToast("Downloading certificate...", "success");
        try {
            const response = await axios.get(`${API_BASE_URL}/generate-pdf/${courseId}`, {
                headers: authHeaders(),
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${courseTitle.replace(/\s+/g, '_')}_Certificate.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download error:", error);
            triggerToast("Failed to download certificate. Try again.", "error");
        }
    };

    // ✅ NEW: Handle Syllabus Download (Direct Link)
    const handleDownloadSyllabus = (url: string) => {
        if (!url) {
            triggerToast("No syllabus link available.", "error");
            return;
        }
        window.open(url, '_blank');
    };

    const openEnrollModal = (course: Course) => {
        setSelectedCourse(course);
        setPromoCode("");
        setPromoInfo(null);
        setShowModal(true);
    };
    const handleLogout = () => { clearSession(); navigate("/login", { replace: true }); };

    // --- ⚔️ THE REAL CODE ARENA VIEW ---
    if (activeTest) {
        return (
            <div className="flex flex-col lg:flex-row h-screen bg-canvas font-sans overflow-hidden relative">
                {isFullScreenViolation && (
                    <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex flex-col items-center justify-center text-center p-6">
                        <div className="mb-6"><AlertTriangle size={60} className="text-red-500 mx-auto mb-4" /></div>
                        <h1 className="text-2xl lg:text-4xl font-extrabold text-white tracking-widest mb-4">TEST INTERRUPTED</h1>
                        <p className="text-slate-400 text-sm lg:text-lg max-w-lg mb-2">You have exited full-screen mode. This is a proctoring violation.</p>
                        <div className="bg-white/10 px-8 py-3 rounded-lg border border-red-500/30 mb-8"><span className="text-red-400 font-bold text-lg tracking-wider">Remaining Warnings: {Math.max(0, 3 - warnings)}</span></div>
                        <button onClick={returnToFullScreen} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 lg:px-8 lg:py-4 rounded font-bold text-sm lg:text-lg tracking-wider flex items-center gap-2"><Monitor size={20} /> RETURN TO FULL SCREEN</button>
                    </div>
                )}

                {/* LEFT PANEL: Question & Cam */}
                <div className="w-full lg:w-[35%] h-[40%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-slate-300 bg-white shadow-lg z-10">
                    <div className="h-12 lg:h-16 border-b border-slate-200 flex items-center px-4 lg:px-6 bg-white shrink-0">
                        <h3 className="text-lg lg:text-2xl font-extrabold text-slate-800 truncate">problem {currentProblemIndex + 1}</h3>
                        <span className="ml-auto bg-yellow-100 text-yellow-700 text-[10px] lg:text-xs font-bold px-2 py-1 rounded">MEDIUM</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-white">
                        <p className="text-slate-500 mb-6 italic">No description provided.</p>
                        {activeTest.problems[currentProblemIndex]?.description && <div className="prose prose-sm text-slate-600 mb-6">{activeTest.problems[currentProblemIndex].description}</div>}
                        <h4 className="font-extrabold text-slate-900 mb-4 text-xs lg:text-sm uppercase tracking-wide">TEST CASES</h4>
                        <div className="space-y-2">{JSON.parse(activeTest.problems[currentProblemIndex]?.test_cases || "[]").filter((tc: any) => !tc.hidden).map((tc: any, i: number) => (<div key={i} className="bg-slate-50 border border-slate-200 p-2 lg:p-3 rounded text-xs lg:text-sm"><span className="font-mono font-bold block">Input: {tc.input}</span></div>))}</div>
                    </div>

                    {/* Camera View - Smaller on Mobile */}
                    <div className="h-32 lg:h-56 bg-slate-100 border-t border-slate-300 p-2 lg:p-4 relative flex items-center justify-center overflow-hidden shrink-0">
                        <video ref={videoRef} autoPlay muted className="w-full h-full object-cover rounded-lg border-2 border-slate-300 bg-black" />
                        <div className="absolute top-4 left-4 lg:top-6 lg:left-6 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> REC</div>
                        {faceStatus !== "ok" && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"><span className="text-red-400 font-bold bg-black px-2 py-1 rounded border border-red-500 text-xs lg:text-sm">FACE MISSING</span></div>}
                    </div>
                </div>

                {/* RIGHT PANEL: Editor & Terminal */}
                <div className="w-full lg:w-[65%] h-[60%] lg:h-full flex flex-col bg-[#F3F4F6]">
                    <div className="h-10 lg:h-12 bg-white border-b border-slate-200 flex items-center justify-between px-2 lg:px-4 shrink-0">
                        <span className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Code size={14} /> Code Editor</span>
                        <select value={language} onChange={(e) => {
                            const newLangId = Number(e.target.value);
                            setLanguage(newLangId);
                            const template = newLangId === 71 ? CODE_TEMPLATES.python : (newLangId === 62 ? CODE_TEMPLATES.java : CODE_TEMPLATES.cpp);
                            setUserCode(template);
                        }} className="text-[10px] lg:text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold text-slate-700">
                            {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 bg-white relative">
                        <Editor height="100%" theme="light" language={languages.find(l => l.id === language)?.value} value={userCode} onChange={(val) => setUserCode(val || "")} options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, fontFamily: "'JetBrains Mono', monospace", padding: { top: 16 }, lineNumbers: "on" }} />
                    </div>

                    {/* Terminal - Smaller on mobile */}
                    <div className="h-24 lg:h-32 bg-[#0F172A] border-t border-slate-700 text-slate-300 p-2 lg:p-3 font-mono text-[10px] lg:text-xs overflow-y-auto flex flex-col shrink-0">
                        <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-[10px] mb-2 border-b border-slate-700 pb-1"><Monitor size={12} /> Terminal Output</div>
                        <pre className={`whitespace-pre-wrap flex-1 ${executionStatus === "error" ? "text-red-400" : "text-green-400"}`}>{executionStatus === "running" ? <span className="text-yellow-400">Compiling...</span> : consoleOutput}</pre>
                    </div>

                    <div className="h-14 lg:h-16 bg-white border-t border-slate-200 flex items-center justify-end px-4 lg:px-6 gap-2 lg:gap-4 shrink-0">
                        <button onClick={() => switchQuestion(currentProblemIndex + 1 < activeTest.problems.length ? currentProblemIndex + 1 : 0)} className="flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs lg:text-sm hover:bg-slate-50 transition-colors"><ChevronRight size={14} className="lg:w-4 lg:h-4" /> <span className="hidden sm:inline">Next</span></button>

                        {/* 🟢 Run Code (Dry Run) */}
                        <button onClick={handleRunCode} disabled={executionStatus === "running"} className="flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-2.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs lg:text-sm hover:bg-slate-300 transition-colors"><Play size={14} fill="currentColor" className="lg:w-4 lg:h-4" /> Run Code</button>

                        {/* 🔵 Submit (Official Grading) */}
                        <button
                            onClick={handleSubmit}
                            disabled={executionStatus === "running" || !canSubmit}
                            title={!canSubmit ? "Run code successfully first" : "Submit solution"}
                            className={`flex items-center gap-2 px-4 py-2 lg:px-8 lg:py-2.5 rounded-lg border font-bold text-xs lg:text-sm shadow-md transition-all
                            ${canSubmit
                                    ? "bg-[#0088C7] text-white hover:bg-blue-700 border-transparent"
                                    : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                                }`}
                        >
                            <Cloud size={14} className="lg:w-4 lg:h-4" /> Submit
                        </button>
                    </div>
                </div>

                {toast.show && <div className={`fixed top-5 right-5 z-[10000] px-6 py-3 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 animate-bounce ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>{toast.type === "success" ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}{toast.message}</div>}
            </div>
        );
    }

    // ✅ LOADING SPINNER UI
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-canvas">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-iqBlue"></div>
                    <p className="animate-pulse font-bold text-slate-600">Loading iQmath Dashboard...</p>
                </div>
            </div>
        );
    }



    // --- DASHBOARD UI ---
    return (
        <div className="min-h-screen bg-canvas font-sans">

            {/* 1. HEADER BAR */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/60 bg-white/90 px-4 py-4 shadow-soft backdrop-blur-md lg:px-8">

                {/* Left: Logo & Mobile Toggle */}
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 transition-colors hover:text-iqBlue lg:hidden">
                        <Menu size={24} />
                    </button>
                    <BrandLogo size="md" />
                </div>

                {/* Center: Desktop Navigation Menu */}
                <nav className="hidden items-center gap-1 rounded-full border border-slate-100 bg-surfaceMuted/80 p-1 lg:flex">
                    <NavItem icon={<LayoutDashboard size={18} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
                    <NavItem icon={<BookOpen size={18} />} label="My Learning" active={activeTab === "learning"} onClick={() => setActiveTab("learning")} />
                    <NavItem icon={<Code size={18} />} label="Code Test" active={activeTab === "test"} onClick={() => setActiveTab("test")} />
                    <NavItem icon={<Compass size={18} />} label="Explore" active={activeTab === "explore"} onClick={() => setActiveTab("explore")} />
                    <NavItem icon={<Award size={18} />} label="Certificates" active={activeTab === "certificates"} onClick={() => setActiveTab("certificates")} />
                </nav>

                {/* Right: Actions (Notification & Profile) */}
                <div className="flex items-center gap-2 lg:gap-4">

                    {/* Notification Bell */}
                    <button
                        onClick={() => {
                            setActiveTab("notifications");
                            setUnreadCount(0);
                            axios.patch(`${API_BASE_URL}/notifications/read`, {}, { headers: authHeaders() });
                        }}
                        className="relative rounded-full bg-iqBlueLight p-2 text-iqBlue transition-colors hover:bg-iqBlue hover:text-white"
                    >
                        <BellRing size={20} />
                        {unreadCount > 0 && <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"></span>}
                    </button>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex h-9 w-9 items-center justify-center rounded-full bg-iqBlue font-bold text-white shadow-soft transition-transform hover:scale-105 lg:h-10 lg:w-10">
                            <User size={18} className="lg:h-5 lg:w-5" />
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 top-12 z-50 w-64 animate-fade-in rounded-2xl border border-slate-100 bg-white p-4 shadow-lift">
                                <div className="mb-3 border-b border-slate-100 pb-3">
                                    <p className="truncate font-bold text-slate-800">{studentProfile.name}</p>
                                    <p className="truncate text-xs text-slate-500">{studentProfile.email}</p>
                                </div>
                                <button onClick={() => { setActiveTab("settings"); setShowProfileMenu(false); }} className="mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-sm font-bold text-slate-600 transition-colors hover:bg-iqBlueLight hover:text-iqBlue">
                                    <Settings size={16} /> Settings
                                </button>
                                <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg p-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-50">
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Toggle (Visible on small screens) */}
                    <button className="p-2 text-slate-600 md:hidden" onClick={() => setCollapsed(!collapsed)}>
                        <Menu size={24} />
                    </button>
                </div>
            </header>

            {/* 2. MOBILE MENU OVERLAY */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: -300 }}
                        animate={{ x: 0 }}
                        exit={{ x: -300 }}
                        className="absolute left-0 top-0 flex h-full w-64 flex-col gap-6 bg-white p-6 shadow-lift"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <span className="text-xl font-extrabold tracking-tight">
                                <span className="text-iqGreen">IQ</span>
                                <span className="text-iqBlue"> Math</span>
                                <span className="text-iqGreen"> Pro</span>
                            </span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="flex flex-col gap-2">
                            <NavItem icon={<LayoutDashboard size={20} />} label="Home" active={activeTab === "home"} onClick={() => { setActiveTab("home"); setIsMobileMenuOpen(false); }} />
                            <NavItem icon={<BookOpen size={20} />} label="My Learning" active={activeTab === "learning"} onClick={() => { setActiveTab("learning"); setIsMobileMenuOpen(false); }} />
                            <NavItem icon={<Code size={20} />} label="Code Test" active={activeTab === "test"} onClick={() => { setActiveTab("test"); setIsMobileMenuOpen(false); }} />
                            <NavItem icon={<Compass size={20} />} label="Explore" active={activeTab === "explore"} onClick={() => { setActiveTab("explore"); setIsMobileMenuOpen(false); }} />
                            <NavItem icon={<Award size={20} />} label="Certificates" active={activeTab === "certificates"} onClick={() => { setActiveTab("certificates"); setIsMobileMenuOpen(false); }} />
                        </nav>

                        <div className="mt-auto border-t border-slate-100 pt-4">
                            <button onClick={handleLogout} className="flex items-center gap-3 w-full p-2 rounded-lg text-red-500 hover:bg-red-50 text-sm font-bold transition-colors">
                                <LogOut size={20} /> Logout
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* 3. MAIN CONTENT AREA (Full Width) */}
            <main className="mx-auto max-w-7xl p-4 lg:p-8">

                {/* Dynamic Title based on Tab */}
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
                        {activeTab === "home" && "Dashboard Overview"}
                        {activeTab === "learning" && "My Learning"}
                        {activeTab === "explore" && "Explore Courses"}
                        {activeTab === "test" && "Coding Arena"}
                        {activeTab === "certificates" && "My Achievements"}
                        {activeTab === "notifications" && "Notifications"}
                        {activeTab === "settings" && "Account Settings"}
                    </h2>
                    <p className="font-medium text-slate-500">Welcome to your student portal</p>
                </div>

                {/* --- CONTENT SECTIONS --- */}

                {/* NOTIFICATIONS TAB */}
                {activeTab === "notifications" && (
                    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
                        {notifications.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-300">No notifications yet.</div>
                        ) : (
                            notifications.map((n) => (
                                <div key={n.id} className={`p-5 rounded-xl border flex gap-4 transition-all ${n.is_read ? "bg-white border-slate-200" : "bg-blue-50 border-blue-200"}`}>
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full h-fit"><BellRing size={20} /></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">{n.title}</h4>
                                        <p className="text-slate-600 text-sm mt-1">{n.message}</p>
                                        <span className="text-xs text-slate-400 mt-2 block">{new Date(n.created_at).toLocaleString()}</span>
                                    </div>
                                    <button onClick={async () => { await axios.delete(`${API_BASE_URL}/notifications/${n.id}`, { headers: authHeaders() }); fetchNotifications(); }} className="text-slate-300 hover:text-red-500 h-fit"><Trash2 size={18} /></button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* HOME TAB */}
                {activeTab === "home" && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-8">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <StatCard icon={BookOpen} label="Courses Enrolled" value={enrolledCourses.length} delay={0} />
                            <StatCard icon={Award} label="Certificates Earned" value={0} delay={0.08} />
                            <StatCard icon={Trophy} label="Challenges Attended" value={codeTests.filter(t => t.completed).length} delay={0.16} />
                        </div>
                        <div>
                            <h3 className="mb-4 text-xl font-bold tracking-tight text-slate-800">Continue Learning</h3>
                            {enrolledCourses.length > 0 ? (
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    {enrolledCourses.slice(0, 2).map((course, idx) => { // Show max 2 here
                                        const prog = progressMap[course.id] || { percent: 0, completed: 0, total: 0 };
                                        return (
                                            <motion.div
                                                key={course.id}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 + idx * 0.08 }}
                                                className="flex flex-col items-center gap-6 rounded-2xl border border-slate-100 bg-surface p-6 shadow-soft md:flex-row"
                                            >
                                                <div className="h-32 w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-iqBlueLight/50 md:w-1/3">
                                                    {course.image_url ? (
                                                        <FastImage src={course.image_url} alt="" widthHint={320} className="h-full w-full object-cover" skeletonClassName="h-full w-full" />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-slate-300"><BookOpen /></div>
                                                    )}
                                                </div>
                                                <div className="w-full flex-1">
                                                    <h4 className="mb-2 text-lg font-bold text-slate-800">{course.title}</h4>
                                                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-iqBlue">
                                                        <Zap size={14} className="fill-current text-amber-400" /> In Progress
                                                    </div>
                                                    <div className="mb-2 h-2 w-full rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-iqBlue to-iqGreen transition-all duration-500" style={{ width: `${prog.percent}%` }}></div></div>
                                                    <div className="mb-4 flex justify-between text-xs font-bold text-slate-500"><span>{prog.percent}% Complete</span><span>{prog.completed}/{prog.total} Lessons</span></div>
                                                    <button onClick={() => navigate(`/course/${course.id}/player`)} className="btn-primary w-full py-2.5">
                                                        Resume <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-10 text-center text-slate-400 shadow-soft">You haven't enrolled in any courses yet.</div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* LEARNING TAB */}
                {activeTab === "learning" && (
                    <div>
                        {/* ✅ NEW: Sub-navigation to separate Standard vs Coding courses */}
                        <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
                            <button
                                onClick={() => setLearningSubTab("standard")}
                                className={`rounded-t-lg px-3 pb-2 text-sm font-bold transition-all ${learningSubTab === "standard"
                                    ? "border-b-2 border-iqBlue text-iqBlue"
                                    : "text-slate-500 hover:text-slate-800"
                                    }`}
                            >
                                Standard Courses
                            </button>
                            <button
                                onClick={() => setLearningSubTab("coding")}
                                className={`rounded-t-lg px-3 pb-2 text-sm font-bold transition-all ${learningSubTab === "coding"
                                    ? "border-b-2 border-iqBlue text-iqBlue"
                                    : "text-slate-500 hover:text-slate-800"
                                    }`}
                            >
                                Coding Courses
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {/* ✅ Logic: Filter courses based on the selected sub-tab */}
                            {enrolledCourses
                                .filter(c => {
                                    if (learningSubTab === "standard") return c.course_type !== "coding";
                                    if (learningSubTab === "coding") return c.course_type === "coding";
                                    return true;
                                })
                                .map(c => (
                                    <CourseCard
                                        key={c.id}
                                        course={c}
                                        type="enrolled"
                                        navigate={navigate}
                                        handleDownloadSyllabus={handleDownloadSyllabus}
                                        onPayClick={(course: Course) => {
                                            // Reuse modal logic for payment
                                            setSelectedCourse(course);
                                            setShowModal(true);
                                        }}
                                    />
                                ))
                            }
                            {enrolledCourses.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">No active courses.</div>}
                        </div>
                    </div>
                )}

                {/* EXPLORE TAB */}
                {activeTab === "explore" && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {availableCourses.map(c => (
                            <div
                                key={c.id}
                                id={`course-card-${c.id}`}
                                className={highlightCourseId === c.id ? "rounded-2xl ring-2 ring-iqBlue ring-offset-2 ring-offset-canvas" : undefined}
                            >
                                <CourseCard course={c} type="available" handleFreeEnroll={handleFreeEnroll} openEnrollModal={openEnrollModal} />
                            </div>
                        ))}
                    </div>
                )}

                {/* TEST TAB */}
                {activeTab === "test" && (
                    <div className="grid gap-5">
                        {codeTests.map(test => (
                            <div key={test.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-surface p-6 shadow-soft transition-all hover:shadow-card">
                                <div><h3 className="text-lg font-bold text-slate-800">{test.title}</h3><p className="text-sm text-slate-500">Duration: {test.time_limit} Mins</p></div>
                                <button onClick={() => setShowPassKeyModal(test.id)} className="btn-primary px-6 py-2">Start Test</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* CERTIFICATES TAB */}
                {activeTab === "certificates" && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {enrolledCourses.map(course => (
                                <div key={course.id} className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${course.has_certificate ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                                            {course.has_certificate ? <Award size={24} /> : <Lock size={24} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{course.title}</h4>
                                            {course.has_certificate ? (
                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded mt-1 inline-block">COMPLETED</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded mt-1 inline-block">INCOMPLETE</span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => course.has_certificate ? handleDownloadCertificate(course.id, course.title) : triggerToast("Complete the course first!", "error")}
                                        disabled={!course.has_certificate}
                                        className={`p-2 rounded-lg transition-colors ${course.has_certificate ? "text-[#0088C7] hover:bg-blue-50 cursor-pointer" : "text-slate-300 cursor-not-allowed"}`}
                                        title={course.has_certificate ? "Download Certificate" : "Locked: Complete Course First"}
                                    >
                                        <Download size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === "settings" && (
                    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock size={20} className="text-slate-400" /> Change Password</h3>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0088C7]" /></div>
                            <button onClick={handleUpdatePassword} className="w-full py-3 bg-[#0088C7] hover:bg-blue-700 text-white rounded-xl font-bold transition-all">Update Password</button>
                        </div>
                    </div>
                )}

            </main>


            {/* 🔵 ENROLLMENT MODAL (Correctly Placed Outside Main Loop) */}
            {showModal && selectedCourse && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-2xl max-w-sm w-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#0088C7] to-[#8DC63F]"></div>
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>

                        <div className="p-6 pb-0">
                            <h3 className="text-xl font-extrabold text-slate-800 mb-1">Unlock Course</h3>
                            <p className="text-slate-500 text-xs">You are about to unlock <strong>{selectedCourse.title}</strong>.</p>
                        </div>

                        <div className="p-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 flex items-center justify-between">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Price</span>
                                    {promoInfo ? (
                                        <span className="text-2xl font-extrabold text-[#0088C7]">
                                            ₹{promoInfo.final_price}
                                            <span className="ml-2 text-sm font-bold text-slate-400 line-through">₹{promoInfo.original_price}</span>
                                        </span>
                                    ) : (
                                        <span className="text-2xl font-extrabold text-[#0088C7]">₹{selectedCourse.price}</span>
                                    )}
                                </div>
                                <div className="text-right"><span className="block text-[10px] font-bold text-slate-400 uppercase">Access</span><span className="text-sm font-bold text-slate-700">Lifetime</span></div>
                            </div>

                            <div className="mb-6 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Promo code"
                                    value={promoCode}
                                    onChange={(e) => { setPromoCode(e.target.value); setPromoInfo(null); }}
                                    className="flex-1 p-3 bg-white border border-slate-200 rounded-lg text-sm font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#0088C7]"
                                />
                                <button type="button" onClick={applyPromo} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    Apply
                                </button>
                            </div>
                            {promoInfo && <p className="text-xs text-green-700 font-semibold mb-4 -mt-3">{promoInfo.message}</p>}

                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleEnrollStrategy("paid")} disabled={processing} className="w-full py-3 rounded-lg bg-[#0088C7] hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
                                    {processing ? "Processing..." : <><Lock size={16} /> {(promoInfo?.final_price === 0) ? "Unlock Free with Promo" : "Pay & Unlock Now"}</>}
                                </button>
                                {RAZORPAY_PAYLINK_URL && (
                                    <button
                                        type="button"
                                        onClick={() => window.open(RAZORPAY_PAYLINK_URL, "_blank", "noopener,noreferrer")}
                                        className="w-full py-3 rounded-lg bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                                    >
                                        Pay via Razorpay Link
                                    </button>
                                )}

                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* 🟢 PROFESSIONAL PASS KEY MODAL */}
            {showPassKeyModal !== null && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "white", padding: "30px", borderRadius: "16px", width: "400px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                        <div className="flex justify-center mb-4"><div className="bg-blue-50 p-3 rounded-full"><Lock className="text-[#0088C7]" size={32} /></div></div>
                        <h3 style={{ margin: "0 0 10px 0", fontSize: "20px", fontWeight: "800", color: brand.textMain, textAlign: "center" }}>Enter Access Key</h3>
                        <p className="text-center text-slate-500 text-sm mb-6">This challenge is protected. Enter the pass key provided by your instructor.</p>
                        <input type="text" placeholder="e.g. SECRET123" value={passKeyInput} onChange={(e) => setPassKeyInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-[#0088C7] text-center font-bold text-lg tracking-widest mb-6" />
                        <div style={{ display: "flex", gap: "10px" }}><button onClick={() => setShowPassKeyModal(null)} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${brand.border}`, borderRadius: "8px", fontWeight: "bold", color: brand.textLight, cursor: "pointer" }}>Cancel</button><button onClick={handleStartTest} style={{ flex: 1, padding: "12px", background: brand.iqBlue, border: "none", borderRadius: "8px", fontWeight: "bold", color: "white", cursor: "pointer" }}>Start Test</button></div>
                    </div>
                </div>
            )}

            {/* ✅ PROFESSIONAL TOAST UI */}
            {toast.show && (
                <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "white", padding: "16px 24px", borderRadius: "12px", boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)", borderLeft: `6px solid ${toast.type === "success" ? brand.iqGreen : "#ef4444"}`, display: "flex", alignItems: "center", gap: "12px", animation: "slideIn 0.3s ease-out" }}>
                    {toast.type === "success" ? <CheckCircle size={24} color={brand.iqGreen} /> : <AlertTriangle size={24} color="#ef4444" />}
                    <div><h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: brand.textMain }}>{toast.type === "success" ? "Success" : "Alert"}</h4><p style={{ margin: 0, fontSize: "13px", color: brand.textLight }}>{toast.message}</p></div>
                    <button onClick={() => setToast({ ...toast, show: false })} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px" }}><X size={16} color="#94a3b8" /></button>
                    <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;