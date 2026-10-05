import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import Plyr from "plyr-react";
import "plyr/dist/plyr.css";
import API_BASE_URL from './config';
import { runTestCasesLocally } from './utils/pyodideEnv';
import {
    PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
    UploadCloud, Play, Save, Monitor, Cpu, ChevronDown, ChevronRight, CreditCard,
    File as FileIcon, X, CheckCircle, Radio, Lock, ArrowLeft, AlertCircle, Clock,
    Zap, CheckSquare, Square, CheckCheck, Award, Edit, AlertTriangle, Maximize, Minimize, LockKeyhole, Cloud, Link as ResourceLinkIcon // <--- Added 'Cloud' icon here
} from "lucide-react";
import { CODE_TEMPLATES } from './utils/codeTemplates';

const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// --- 🍞 SHARED TOAST COMPONENT (Unchanged) ---
const ToastNotification = ({ toast, setToast }: any) => {
    if (!toast.show) return null;
    return (
        <div style={{
            position: "fixed", top: "20px", right: "20px", zIndex: 9999,
            background: "white", padding: "16px 24px", borderRadius: "12px",
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)",
            borderLeft: `6px solid ${toast.type === "success" ? "#8DC63F" : "#ef4444"}`,
            display: "flex", alignItems: "center", gap: "12px", animation: "slideIn 0.3s ease-out"
        }}>
            {toast.type === "success" ? <CheckCircle size={24} color="#8DC63F" /> : <AlertCircle size={24} color="#ef4444" />}
            <div>
                <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                    {toast.type === "success" ? "Success" : "Error"}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{toast.message}</p>
            </div>
            <button onClick={() => setToast({ ...toast, show: false })} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px" }}>
                <X size={16} color="#94a3b8" />
            </button>
            <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        </div>
    );
};

// --- 🔄 IMPROVED POLLING HELPER (UPDATED) ---
// We changed this to handle the "Batch JSON" response structure.
// --- 🔄 UPDATED POLLING HELPER ---
// --- POLLING HELPER REMOVED (Lambda is sync) ---

// --- 💻 COMPONENT: CODE COMPILER (For Standard Lessons) ---
// Updated to send 'test_cases' array instead of 'stdin'
const CodeCompiler = ({ lesson }: { lesson: any }) => {
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const triggerToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };
    const problems = useMemo(() => {
        try {
            if (!lesson.test_config) return [];
            let parsed = JSON.parse(lesson.test_config);
            if (typeof parsed === "string") parsed = JSON.parse(parsed);
            return parsed.problems || [];
        } catch (e) {
            console.error("❌ Failed to parse Code Test Config:", e);
            return [];
        }
    }, [lesson.test_config]);

    const [activeProblemIndex, setActiveProblemIndex] = useState(0);
    const activeProblem = problems[activeProblemIndex] || {
        title: "No Problem Configured", description: "Please ask the instructor to update this test.", testCases: []
    };

    const [code, setCode] = useState(CODE_TEMPLATES.python);
    const [output, setOutput] = useState("Ready to execute...");
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState(71);
    const [canSubmit, setCanSubmit] = useState(false); // ✅ Strict Unlock

    const languages = [
        { id: 71, name: "Python (3.8.1)", value: "python" },
        { id: 62, name: "Java (OpenJDK 13)", value: "java" },
        { id: 54, name: "C++ (GCC 9.2.0)", value: "cpp" },
        { id: 63, name: "JavaScript (Node.js)", value: "javascript" },
    ];

    // 🟢 HANDLE RUN CODE (Local / Dry Run)
    const handleRunCode = async () => {
        setLoading(true);
        setOutput("Processing...");
        setCanSubmit(false); // Reset

        const testCasesPayload = activeProblem.testCases || [];

        if (testCasesPayload.length === 0) {
            setOutput("⚠️ No test cases found.");
            setLoading(false);
            return;
        }

        // 1. PYTHON LOCAL CHECK (Strict)
        if (language === 71) {
            setOutput("🔹 Running Local Tests (Pyodide)...");
            const localResult = await runTestCasesLocally(code, testCasesPayload);

            if (localResult.success) {
                setOutput(localResult.output); // Detailed output
                triggerToast("All Local Tests Passed!", "success");
                setCanSubmit(true); // ✅ Unlock
            } else {
                setOutput(`❌ Execution Failed:\n${localResult.error || localResult.output}`);
                triggerToast("Tests Failed", "error");
            }
            setLoading(false);
            return;
        }

        // 2. JAVA/C++ DRY RUN (Full Test Cases)
        setOutput("🚀 Compiling on Server (Dry Run)...");
        try {
            const res = await axios.post(`${API_BASE_URL}/execute`, {
                source_code: code,
                language_id: language,
                test_cases: testCasesPayload
            }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

            const result = res.data;
            const report = result.stats ? result : result.data;

            if (report.error) {
                setOutput(`❌ Server Error: ${report.error}`);
            } else {
                const passed = report.stats?.passed || 0;
                const total = report.stats?.total || 0;

                let display = `✨ Dry Run Complete!\nPassed: ${passed}/${total}\nRuntime: ${report.stats?.runtime_ms}ms\n\n`;
                (report.results || []).forEach((r: any) => {
                    display += `${r.status === "Passed" ? "✅" : "❌"} Case ${r.id + 1}: ${r.status}\n`;
                    if (r.status !== "Passed") display += `   Input: ${r.input}\n   Expected: ${r.expected}\n   Actual: ${r.actual}\n\n`;
                });
                setOutput(display);

                if (total > 0 && passed === total) {
                    setCanSubmit(true); // ✅ Unlock
                    triggerToast("All tests passed!", "success");
                } else {
                    triggerToast("Tests failed", "error");
                }
            }
        } catch (err: any) {
            setOutput("❌ Execution Failed: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // 🔵 HANDLE SUBMIT (Run All Cases)
    const handleSubmit = async () => {
        if (!canSubmit) { triggerToast("Run code successfully first!", "error"); return; }

        setLoading(true);
        setOutput("🚀 Submitting Code...");

        try {
            const testCasesPayload = activeProblem.testCases || [];
            if (testCasesPayload.length === 0) {
                triggerToast("No test cases to run.", "error"); setLoading(false); return;
            }

            const res = await axios.post(`${API_BASE_URL}/execute`, {
                source_code: code,
                language_id: language,
                test_cases: testCasesPayload
            }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

            const result = res.data;
            const report = result.stats ? result : result.data;

            if (report && report.stats) {
                let display = `✨ Execution Complete!\nRuntime: ${report.stats.runtime_ms}ms | Passed: ${report.stats.passed}/${report.stats.total}\n\n`;
                report.results.forEach((r: any) => {
                    display += `${r.status === "Passed" ? "✅" : "❌"} Case ${r.id + 1}: ${r.status}\n`;
                    if (r.status !== "Passed") display += `   Input: ${r.input}\n   Expected: ${r.expected}\n   Actual: ${r.actual}\n\n`;
                });
                setOutput(display);

                if (report.stats.total > 0 && report.stats.passed === report.stats.total) {
                    triggerToast("All Test Cases Passed!", "success");
                    // Optional: Save code on success
                } else {
                    triggerToast("Some test cases failed", "error");
                }
            } else {
                setOutput(result.output !== undefined ? (result.output || "No output returned.") : (result.error || "Execution failed."));
            }
        } catch (err: any) {
            setOutput("❌ Submission Failed: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const saveProgress = () => {
        triggerToast("Code Saved Successfully!", "success");
    };

    if (!problems.length) return (
        <div className="flex items-center justify-center h-full bg-slate-100 text-slate-500 font-bold p-10 text-center">
            ⚠️ No coding problems found. <br /> (Instructor: Please edit and re-save this item in Course Builder).
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row h-full p-2 lg:p-4 gap-4 bg-slate-100 font-sans relative overflow-y-auto lg:overflow-hidden">
            <ToastNotification toast={toast} setToast={setToast} />

            {/* Left Panel: Problems */}
            <div className="w-full lg:w-[40%] h-[400px] lg:h-full flex flex-col gap-4 shrink-0">
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6 overflow-y-auto">
                    <div className="flex gap-2 mb-6 border-b border-slate-100 pb-2 overflow-x-auto">
                        {problems.map((_: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => { setActiveProblemIndex(idx); setOutput("Ready to execute..."); setCanSubmit(false); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${activeProblemIndex === idx ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                            >
                                Problem {idx + 1}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-lg lg:text-xl font-extrabold text-slate-800 m-0">{activeProblem.title}</h2>
                        <span className="bg-yellow-100 text-yellow-700 text-[10px] lg:text-xs font-bold px-2 py-1 rounded uppercase shrink-0">{activeProblem.difficulty || "Medium"}</span>
                    </div>
                    <div className="prose prose-sm text-slate-600 mb-6 whitespace-pre-wrap text-xs lg:text-sm">
                        {activeProblem.description || "No description provided."}
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest mb-3">Test Cases</h3>
                    <div className="space-y-3">
                        {activeProblem.testCases?.map((tc: any, i: number) => (
                            (
                                <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="text-xs font-bold text-slate-500 mb-1">Input:</div>
                                    <div className="font-mono text-xs bg-white p-2 rounded border border-slate-200 mb-2 overflow-x-auto">{tc.input}</div>
                                    <div className="text-xs font-bold text-slate-500 mb-1">Expected Output:</div>
                                    <div className="font-mono text-xs bg-white p-2 rounded border border-slate-200 overflow-x-auto">{tc.output}</div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Editor */}
            <div className="w-full lg:w-[60%] h-[500px] lg:h-full flex flex-col gap-4 shrink-0">
                <div className="flex-[2.5] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px]">
                    <div className="bg-slate-50 border-b border-slate-200 p-2 flex justify-between items-center px-4 h-12">
                        <div className="flex items-center gap-2 text-slate-600 font-bold text-sm"><Code size={16} /> Code Editor</div>
                        <select className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500" value={language} onChange={(e) => {
                            const newLangId = parseInt(e.target.value);
                            setLanguage(newLangId);
                            const template = newLangId === 71 ? CODE_TEMPLATES.python : (newLangId === 62 ? CODE_TEMPLATES.java : CODE_TEMPLATES.cpp);
                            setCode(template);
                        }}>
                            {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <Editor height="100%" defaultLanguage="python" language={languages.find(l => l.id === language)?.value} theme="light" value={code} onChange={(val) => { setCode(val || ""); setCanSubmit(false); }} options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }} />
                    </div>
                </div>
                <div className="flex-[1.5] flex flex-col gap-4 min-h-[200px]">
                    <div className="flex-[1.3] flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-800 text-slate-400 px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Monitor size={14} /> Terminal Output</div>
                        <div className="flex-1 p-4 font-mono text-xs lg:text-sm text-green-400 overflow-y-auto whitespace-pre-wrap">{output}</div>
                    </div>
                    <div className="flex-[0.2] flex gap-3">
                        <button onClick={saveProgress} className="bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-bold rounded-xl flex items-center justify-center gap-2 transition-all p-2"><Save size={18} /></button>
                        <button onClick={handleRunCode} disabled={loading} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 text-sm lg:text-base p-2">{loading ? <Cpu size={18} className="animate-spin" /> : <Play size={18} />} Run Code</button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !canSubmit}
                            title={!canSubmit ? "Run code successfully first" : "Submit solution"}
                            className={`flex-1 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 text-sm lg:text-base p-2 ${canSubmit ? "bg-[#0088C7] hover:bg-[#006FA3] text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
                        >
                            {loading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Cloud size={18} />} Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 🆕 COMPONENT: CODING COURSE PLAYER (Updated Logic) ---
const CodingPlayer = ({ course, token }: { course: any, token: string }) => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [challenges, setChallenges] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("Easy");

    // Problem & Execution State
    const [selectedProblem, setSelectedProblem] = useState<any>(null);
    const [code, setCode] = useState(CODE_TEMPLATES.python);
    const [output, setOutput] = useState("Ready to execute...");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<{ runtime: string, passed: number, total: number, results: any[] } | null>(null);
    const [canSubmit, setCanSubmit] = useState(false); // ✅ Strict Unlock

    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
    const [assessmentLink, setAssessmentLink] = useState("");
    const [assessmentStatus, setAssessmentStatus] = useState<{ submitted: boolean; link: string; file_name: string; submitted_at: string } | null>(null);
    const [assessmentUploading, setAssessmentUploading] = useState(false);
    const triggerToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    useEffect(() => { loadChallenges(); }, []);

    const loadChallenges = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/challenges`, { headers: { Authorization: `Bearer ${token}` } });
            setChallenges(res.data);
        } catch (err) { console.error("Failed to load challenges", err); }
    };

    // --- 🟢 STAGE COMPLETION LOGIC ---
    // Helper to check if a specific level is 100% complete
    const isStageComplete = (level: string) => {
        const stageprobs = challenges.filter(c => c.difficulty === level);
        if (stageprobs.length === 0) return false; // Empty stage is not "complete"
        return stageprobs.every(c => c.is_solved);
    };

    // Logic for Easy, Medium, Hard Status
    const easyComplete = isStageComplete("Easy");
    const mediumComplete = isStageComplete("Medium");
    const hardComplete = isStageComplete("Hard");
    const courseFullyComplete = easyComplete && mediumComplete && hardComplete;

    useEffect(() => {
        if (!courseFullyComplete || !courseId) return;
        axios
            .get(`${API_BASE_URL}/courses/${courseId}/assessment`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                setAssessmentStatus(res.data);
                if (res.data?.link) setAssessmentLink(res.data.link);
            })
            .catch(() => setAssessmentStatus(null));
    }, [courseFullyComplete, courseId, token]);

    // --- 🔒 LOCKING LOGIC ---
    // Medium locked until Easy is done. Hard locked until Medium is done.
    const isTabLocked = (tab: string) => {
        if (tab === "Easy") return false; // Easy always open
        if (tab === "Medium") return !easyComplete;
        if (tab === "Hard") return !mediumComplete;
        return true;
    };

    const handleSubmitAssessment = async () => {
        if (!assessmentFile && !assessmentLink.trim()) {
            triggerToast("Upload a file or paste a project link.", "error");
            return;
        }
        setAssessmentUploading(true);
        try {
            const form = new FormData();
            if (assessmentFile) form.append("file", assessmentFile);
            if (assessmentLink.trim()) form.append("link", assessmentLink.trim());
            const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/assessment`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAssessmentStatus(res.data);
            setAssessmentFile(null);
            triggerToast("Assessment submitted!", "success");
        } catch (err: any) {
            triggerToast(err?.response?.data?.detail || "Assessment submit failed.", "error");
        } finally {
            setAssessmentUploading(false);
        }
    };

    const handleClaimCertificate = async () => {
        try {
            const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/claim-certificate`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === "success") {
                triggerToast("🎉 Certificate Generated!", "success");
                setTimeout(() => navigate("/student-dashboard"), 2000);
            } else {
                triggerToast(res.data.message, "error");
            }
        } catch (e: any) {
            triggerToast(e?.response?.data?.message || e?.response?.data?.detail || "Failed to claim certificate", "error");
        }
    };

    // 🟢 HANDLE RUN CODE (Dry Run)
    const handleRunCode = async () => {
        setLoading(true);
        setOutput("Processing...");
        setCanSubmit(false); // Reset
        const langMap: any = { "python": 71, "java": 62, "cpp": 54, "javascript": 63 };
        const langId = langMap[course.language] || 71;

        let allCases: any[] = [];
        try {
            allCases = typeof selectedProblem.test_cases === 'string' ? JSON.parse(selectedProblem.test_cases) : selectedProblem.test_cases;
        } catch (e) { allCases = []; }

        if (!allCases || allCases.length === 0) {
            setOutput("⚠️ No test cases found.");
            setLoading(false);
            return;
        }

        if (langId === 71) {
            setOutput("🔹 Running Local Tests (Pyodide)...");
            const localResult = await runTestCasesLocally(code, allCases);

            if (localResult.success) {
                setOutput(localResult.output);
                triggerToast("All Local Tests Passed!", "success");
                setCanSubmit(true); // ✅ Unlock logic
            } else {
                setOutput(`❌ Local Execution Failed:\n${localResult.error || localResult.output}`);
                triggerToast("Tests Failed", "error");
            }
            setLoading(false);
            return;
        }

        // Java/C++ Dry Run
        setOutput("🚀 Compiling on Server (Dry Run)...");
        try {
            const res = await axios.post(`${API_BASE_URL}/execute`, {
                source_code: code,
                language_id: langId,
                test_cases: allCases // Send ALL cases
            }, { headers: { Authorization: `Bearer ${token}` } });

            const report = res.data.stats ? res.data : res.data.data;

            if (report.error) {
                setOutput(`❌ Server Error: ${report.error}`);
            } else {
                const passed = report.stats?.passed || 0;
                const total = report.stats?.total || 0;

                let display = `✨ Dry Run Complete!\nPassed: ${passed}/${total}\nRuntime: ${report.stats?.runtime_ms}ms\n\n`;
                (report.results || []).forEach((r: any) => {
                    display += `${r.status === "Passed" ? "✅" : "❌"} Case ${r.id + 1}: ${r.status}\n`;
                    if (r.status !== "Passed") display += `   Input: ${r.input}\n   Expected: ${r.expected}\n   Actual: ${r.actual}\n\n`;
                });
                setOutput(display);

                if (total > 0 && passed === total) {
                    setCanSubmit(true); // ✅ Unlock logic
                    triggerToast("All tests passed!", "success");
                } else {
                    triggerToast("Tests failed", "error");
                }
            }
        } catch (err: any) {
            setOutput("System Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // 🔵 HANDLE SUBMIT (Grading)
    const handleSubmit = async () => {
        if (!canSubmit) { triggerToast("Run code successfully first!", "error"); return; }
        setLoading(true);
        setOutput("🚀 Submitting to Official Grader...");
        setStats(null);

        try {
            const langMap: any = { "python": 71, "java": 62, "cpp": 54, "javascript": 63 };
            const langId = langMap[course.language] || 71;

            let cases = [];
            try {
                cases = typeof selectedProblem.test_cases === 'string' ? JSON.parse(selectedProblem.test_cases) : selectedProblem.test_cases;
            } catch (e) {
                setOutput("❌ Error: Invalid Test Case Format.");
                setLoading(false); return;
            }

            if (!cases || cases.length === 0) {
                setOutput("❌ Error: No Test Cases Found.");
                triggerToast("Cannot submit empty test cases", "error");
                setLoading(false); return;
            }

            const res = await axios.post(`${API_BASE_URL}/execute`, {
                source_code: code,
                language_id: langId,
                test_cases: cases
            }, { headers: { Authorization: `Bearer ${token}` } });

            let report = res.data;
            if (report.error) {
                setOutput(`❌ SERVER ERROR:\n\n${report.error}`);
                setLoading(false);
                return;
            }

            setStats({
                runtime: `${report.stats?.runtime_ms || 0} ms`,
                passed: report.stats?.passed || 0,
                total: report.stats?.total || 0,
                results: report.results || []
            });

            if (report.stats?.total > 0 && report.stats?.passed === report.stats?.total) {
                setOutput("🎉 SUCCESS! All Test Cases Passed.");
                triggerToast("Problem Solved!", "success");

                // 1. Mark Solved in Backend
                await axios.post(`${API_BASE_URL}/challenges/${selectedProblem.id}/solve`, {}, { headers: { Authorization: `Bearer ${token}` } });

                // 2. Update Local State
                const updated = challenges.map(c => c.id === selectedProblem.id ? { ...c, is_solved: true } : c);
                setChallenges(updated);
            } else {
                const fail = report.results?.find((r: any) => r.status !== "Passed");
                if (fail) setOutput(`❌ TEST FAILED (Case ${fail.id + 1})\n\nInput: ${fail.input}\nExpected: ${fail.expected}\nActual: ${fail.actual}`);
                triggerToast("Hidden Test Cases Failed", "error");
            }

        } catch (err: any) {
            setOutput("System Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    if (selectedProblem) {
        return (
            <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#F8FAFC] font-sans p-2 lg:p-6 overflow-hidden relative">
                <ToastNotification toast={toast} setToast={setToast} />

                {/* LEFT PANEL */}
                <div className="w-full lg:w-[35%] flex flex-col h-[40vh] lg:h-full bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 lg:mb-0 lg:mr-6 overflow-hidden shrink-0">
                    <div className="p-4 lg:p-5 border-b border-slate-100 flex items-center gap-3">
                        <button onClick={() => { setSelectedProblem(null); setStats(null); setOutput("Ready to execute..."); setCanSubmit(false); }} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
                            <ArrowLeft size={18} />
                        </button>
                        <h2 className="text-xs lg:text-sm font-bold text-slate-500 uppercase tracking-wide">{course.language}</h2>
                    </div>
                    <div className="p-4 lg:p-8 overflow-y-auto flex-1">
                        <h1 className="text-xl lg:text-3xl font-extrabold text-slate-900 mb-4">{selectedProblem.title}</h1>
                        <div className="prose prose-sm prose-slate text-slate-600 leading-relaxed mb-8 whitespace-pre-wrap">{selectedProblem.description}</div>

                        {/* RESULT BOX */}
                        {stats && (
                            <div className={`p-4 rounded-xl mb-6 border ${stats.passed === stats.total ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-base lg:text-lg flex items-center gap-2">
                                        {stats.passed === stats.total ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                        {stats.passed === stats.total ? "Accepted" : "Wrong Answer"}
                                    </h3>
                                    <span className="text-xs font-mono bg-white/50 px-2 py-1 rounded border border-black/5">Time: {stats.runtime}</span>
                                </div>
                                <p className="text-sm font-bold">{stats.passed} / {stats.total} cases passed</p>
                            </div>
                        )}

                        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest mb-4">TEST CASES</h3>
                        <div className="space-y-4">
                            {(typeof selectedProblem.test_cases === 'string' ? JSON.parse(selectedProblem.test_cases) : selectedProblem.test_cases).map((tc: any, i: number) => {
                                if (tc.hidden) return null;
                                return (
                                    <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">Input: {tc.input}</div>
                                        <div className="text-xs font-bold text-slate-500">Output: {tc.output}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-full lg:w-[65%] flex flex-col h-[60vh] lg:h-full gap-4 shrink-0">
                    <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
                        <div className="h-10 lg:h-12 border-b border-slate-100 flex items-center justify-between px-4 lg:px-6 bg-white shrink-0">
                            <div className="flex items-center gap-2 text-[#0088C7] font-bold text-xs lg:text-sm"><Code size={16} /> Code Editor</div>
                            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">⚠️ Use "return", do not use "input()"</span>
                        </div>
                        <div className="flex-1 p-2">
                            <Editor height="100%" defaultLanguage={course.language || "python"} theme="light" value={code} onChange={(val) => { setCode(val || ""); setCanSubmit(false); }} options={{ minimap: { enabled: false }, fontSize: 15, padding: { top: 20 }, scrollBeyondLastLine: false }} />
                        </div>
                    </div>
                    <div className="flex-[1] bg-[#0f172a] rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex flex-col min-h-[150px]">
                        <div className="h-8 lg:h-10 bg-[#1e293b] border-b border-slate-700 flex items-center px-4 shrink-0">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Monitor size={14} /> Output</span>
                        </div>
                        <div className="flex-1 p-3 lg:p-5 font-mono text-xs lg:text-sm text-[#4ade80] overflow-auto whitespace-pre-wrap leading-relaxed">{output}</div>
                        <div className="p-3 lg:p-4 bg-slate-800 flex justify-end gap-4 shrink-0">
                            <button onClick={handleRunCode} disabled={loading} className="px-6 py-2 lg:px-8 lg:py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold shadow-lg flex items-center gap-2 transition-all text-sm lg:text-base">
                                {loading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Play size={18} />} Run Code
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !canSubmit}
                                title={!canSubmit ? "Run code first" : "Submit solution"}
                                className={`px-6 py-2 lg:px-8 lg:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all text-sm lg:text-base ${canSubmit ? "bg-[#0088C7] hover:bg-[#006FA3] text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
                            >
                                {loading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> : <Cloud size={18} />} Submit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-4 lg:p-10">
            <ToastNotification toast={toast} setToast={setToast} />
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-10 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/student-dashboard")} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"><ChevronLeft size={20} /></button>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 m-0">{course.title}</h1>
                            <p className="text-slate-500 text-sm mt-1">Language: <span className="font-bold text-[#0088C7] uppercase">{course.language}</span></p>
                        </div>
                    </div>
                </div>

                {/* --- 🟢 STAGE TABS WITH DOUBLE TICK LOGIC --- */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { name: "Easy", complete: easyComplete },
                        { name: "Medium", complete: mediumComplete },
                        { name: "Hard", complete: hardComplete }
                    ].map(tab => {
                        const locked = isTabLocked(tab.name);
                        return (
                            <button
                                key={tab.name}
                                disabled={locked}
                                onClick={() => setActiveTab(tab.name)}
                                className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border shrink-0
                                    ${activeTab === tab.name ? "bg-[#0088C7] text-white shadow-lg scale-105 border-transparent" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}
                                    ${tab.complete ? "border-green-500 bg-green-50 text-green-700" : ""}
            `}
                                style={{ opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "pointer" }}
                            >
                                {tab.name} Level
                                {locked && <Lock size={14} />}
                                {tab.complete && <CheckCheck size={16} className="text-green-600" />} {/* ✅ Double Tick */}
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {challenges.filter(c => c.difficulty === activeTab).map((c, idx) => (
                        <div key={c.id} className={`bg-white p-6 rounded-2xl border transition-all hover:shadow-xl group relative overflow-hidden ${c.is_solved ? "border-green-200 bg-green-50/30" : "border-slate-200"}`}>
                            {c.is_solved && <div className="absolute top-0 right-0 bg-[#8DC63F] text-white p-1 rounded-bl-xl"><CheckCircle size={16} /></div>}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${c.is_solved ? "bg-green-100 text-green-700" : "bg-blue-50 text-[#0088C7]"}`}>
                                    {idx + 1}
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg line-clamp-1">{c.title}</h4>
                            </div>
                            <p className="text-slate-500 text-sm line-clamp-2 mb-6 h-10">{c.description}</p>
                            <button
                                onClick={() => setSelectedProblem(c)}
                                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${c.is_solved ? "bg-white border border-green-200 text-green-700" : "bg-slate-900 text-white hover:bg-[#0088C7]"}`}
                            >
                                {c.is_solved ? "Solve Again" : "Solve Challenge"} {!c.is_solved && <ArrowLeft className="rotate-180" size={16} />}
                            </button>
                        </div>
                    ))}
                    {challenges.filter(c => c.difficulty === activeTab).length === 0 && (
                        <div className="col-span-full text-center py-20 text-slate-400">
                            <p className="font-bold text-lg">No challenges available in this section yet.</p>
                        </div>
                    )}
                </div>

                {/* --- 🏆 ASSESSMENT + CERTIFICATE --- */}
                {courseFullyComplete && (
                    <div className="mt-12 p-8 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl text-center shadow-xl text-white animate-fade-in space-y-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Award size={32} className="text-white" />
                        </div>
                        <h2 className="text-3xl font-extrabold mb-2">Course Completed!</h2>
                        <p className="opacity-90">Submit your project assessment, then claim your certificate.</p>
                        <div className="bg-white/10 rounded-xl p-4 text-left space-y-2 max-w-xl mx-auto">
                            {assessmentStatus?.submitted ? (
                                <p className="text-sm font-semibold">Assessment submitted {assessmentStatus.submitted_at}</p>
                            ) : (
                                <p className="text-sm">File and/or public project link required.</p>
                            )}
                            <input
                                type="url"
                                placeholder="https://… project link"
                                value={assessmentLink}
                                onChange={(e) => setAssessmentLink(e.target.value)}
                                className="w-full rounded-lg px-3 py-2 text-slate-800 text-sm"
                            />
                            <input type="file" accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt" onChange={(e) => setAssessmentFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                            <button type="button" onClick={handleSubmitAssessment} disabled={assessmentUploading} className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold text-sm">
                                {assessmentUploading ? "Submitting…" : "Submit assessment"}
                            </button>
                        </div>
                        <button
                            onClick={handleClaimCertificate}
                            disabled={!assessmentStatus?.submitted}
                            className={`bg-white text-green-700 px-8 py-3 rounded-xl font-bold transition-transform shadow-lg ${assessmentStatus?.submitted ? "hover:scale-105" : "opacity-50 cursor-not-allowed"}`}
                        >
                            {assessmentStatus?.submitted ? "Claim Certificate" : "Submit Assessment First"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
};
const getYoutubeIdFromUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getDriveEmbedUrlFromUrl = (url: string) => {
    if (!url) return null;
    if (url.includes("drive.google.com")) {
        return url.replace(/\/view.*/, "/preview").replace(/\/edit.*/, "/preview");
    }
    return null;
};

/** Warm YouTube CDN for a lesson URL (thumbnail fetch opens the connection early). */
const prefetchYoutubeWarmup = (url?: string) => {
    const id = url ? getYoutubeIdFromUrl(url) : null;
    if (!id || typeof document === "undefined") return;
    const href = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    if (document.querySelector(`link[data-yt-warm="${id}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = href;
    link.setAttribute("data-yt-warm", id);
    document.head.appendChild(link);
};

// --- 🎬 VIDEO PLAYER (same Plyr frame; mounts on next paint instead of a fixed 1s wait) ---
const DelayedVideoPlayer = ({ lesson, plyrOptions }: { lesson: any, plyrOptions: any }) => {
    const [isReady, setIsReady] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // 1️⃣ REFS: One for API, One for the Super Container
    const plyrRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const videoId = getYoutubeIdFromUrl(lesson.url || "");
    const driveUrl = getDriveEmbedUrlFromUrl(lesson.url || "");
    const plyrSource = useMemo(
        () =>
            videoId
                ? { type: "video" as const, sources: [{ src: videoId, provider: "youtube" as const }] }
                : null,
        [videoId]
    );

    // Mount after one paint so Plyr gets a stable container (avoids crash without 1s delay)
    useEffect(() => {
        setIsReady(false);
        let cancelled = false;
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                if (!cancelled) setIsReady(true);
            });
        });
        prefetchYoutubeWarmup(lesson.url);
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [lesson.id, lesson.url]);

    // 2️⃣ CUSTOM FULLSCREEN TOGGLE
    const toggleFullScreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error("Fullscreen failed", err));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    };

    // 3️⃣ HIDE DEFAULT FULLSCREEN BUTTON (So users use ours)
    // We override the passed options to remove 'fullscreen' from controls
    const customOptions = useMemo(() => ({
        ...plyrOptions,
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume'], // ❌ Removed 'fullscreen'
        autopause: true,
        resetOnEnd: false,
    }), [plyrOptions]);

    if (!videoId && !driveUrl) return <div className="text-white p-10">Invalid Video URL</div>;

    if (!isReady) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black min-h-[280px]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-white/80 text-xs font-bold tracking-wide">Starting video…</p>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%", background: "black", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* 4️⃣ SUPER CONTAINER: This goes fullscreen, carrying everything inside */}
            <div
                ref={containerRef}
                className="group relative"
                style={{
                    width: isFullscreen ? "100vw" : "100%",
                    height: isFullscreen ? "100vh" : "auto",
                    maxWidth: isFullscreen ? "none" : "1000px",
                    borderRadius: isFullscreen ? "0" : "12px",
                    overflow: "hidden",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    background: "black",
                    display: "flex", // Centers video in fullscreen
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <style>{`
                    .plyr__video-embed iframe { top: -50%; height: 200%; } 
                    :root { --plyr-color-main: #0088C7; }
                    /* Hide YouTube Title/Avatar */
                    .plyr__video-embed iframe { pointer-events: none; }
                `}</style>

                {/* Wrapper allows styling the player size properly within flex container */}
                <div style={{ width: "100%", height: "100%" }}>
                    {videoId && plyrSource && (
                        <Plyr
                            ref={plyrRef}
                            key={lesson.id}
                            source={plyrSource}
                            options={customOptions} // ✅ Uses options WITHOUT default fullscreen button
                        />
                    )}
                    {driveUrl && (
                        <iframe
                            src={driveUrl}
                            width="100%"
                            height="100%"
                            style={{ border: "none", minHeight: isFullscreen ? "100vh" : "500px" }}
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            loading="eager"
                        />
                    )}
                </div>

                {/* 🛡️ INTERCEPTOR SHIELD (Still works in Fullscreen!) */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "85%", // Covers top 85%
                        zIndex: 50,
                        cursor: "pointer",
                        background: "transparent",
                        touchAction: "manipulation"
                    }}
                    onClick={() => {
                        if (videoId && plyrRef.current?.plyr) {
                            plyrRef.current.plyr.togglePlay();
                        }
                        // For Drive, we can't toggle play via JS easily on an iframe, so this shield mainly prevents pop-outs.
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log("🛡️ Blocked Double Tap");
                    }}
                />

                {/* 5️⃣ CUSTOM FULLSCREEN BUTTON (Floating Overlay) */}
                <button
                    onClick={toggleFullScreen}
                    className="absolute bottom-16 right-6 z-[60] bg-black/60 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors opacity-0 group-hover:opacity-100 duration-300"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
            </div>
        </div>
    );
};

// --- 🕵️ PROCTORING COMPONENT (FIXED) ---
const LiveTestProctor = ({ lesson }: { lesson: any }) => {
    // States: 
    // waiting (future) | countdown (<5 min) | ready (start btn) | 
    // rules (instructions) | active (test running) | 
    // terminated (banned) | expired (time up)

    if (!lesson.start_time || !lesson.end_time) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center h-full text-slate-500">
                <AlertCircle size={48} className="text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Configuration Error</h2>
                <p>This test has no scheduled time set.</p>
                <p className="text-xs mt-2 text-slate-400">Instructor: Please edit this item in Course Builder and set the Start/End times.</p>
            </div>
        );
    }

    const [status, setStatus] = useState("checking");

    const [countdownString, setCountdownString] = useState("");
    const [testTimerString, setTestTimerString] = useState("");

    // Initialize with 0, but we will fetch the REAL count immediately
    const [violationCount, setViolationCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // 1. ✅ CRITICAL FIX: Fetch REAL status on mount to prevent "Zombie" tests
    useEffect(() => {
        const fetchFreshStatus = async () => {
            try {
                const token = localStorage.getItem("token");
                // Call the new endpoint we just added
                const res = await axios.get(`${API_BASE_URL}/proctoring/status/${lesson.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.is_terminated) {
                    setStatus("terminated");
                } else {
                    setViolationCount(res.data.violation_count);
                }
            } catch (e) {
                console.error("Failed to verify proctor status", e);
                // Fallback to prop data if API fails
                if (lesson.is_terminated) setStatus("terminated");
            }
        };
        fetchFreshStatus();
    }, [lesson.id]); // Only run once when lesson changes

    // 2. MASTER TIME CONTROLLER
    useEffect(() => {
        const checkTime = () => {
            // If we already confirmed termination via API, Stop.
            if (status === "terminated") return;

            const now = new Date();
            const start = new Date(lesson.start_time);
            const end = new Date(lesson.end_time);

            if (now > end) {
                setStatus("expired");
                return;
            }

            if (now >= start && now <= end) {
                // If we are in checking/waiting/countdown, move to ready
                // BUT DO NOT OVERRIDE 'terminated' or 'active'
                if (["checking", "waiting", "countdown"].includes(status)) {
                    setStatus("ready");
                }

                // Timer Logic
                const diff = end.getTime() - now.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTestTimerString(`${hours}h ${minutes}m ${seconds} s`);
            } else if (now < start) {
                const diff = start.getTime() - now.getTime();
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);

                if (diff <= 5 * 60 * 1000) {
                    setStatus("countdown");
                    setCountdownString(`${minutes}m ${seconds} s`);
                } else {
                    setStatus("waiting");
                }
            }
        };

        const interval = setInterval(checkTime, 1000);
        checkTime(); // Run once immediately
        return () => clearInterval(interval);
    }, [lesson, status]); // 'status' dep ensures we don't overwrite active/terminated states

    // 3. REPORT VIOLATION
    const reportViolation = async () => {
        if (status === "terminated" || status === "expired") return;

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_BASE_URL}/proctoring/violation`,
                { lesson_id: lesson.id },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setViolationCount(res.data.violation_count);

            if (res.data.status === "terminated") {
                setStatus("terminated");
                document.exitFullscreen().catch(() => { });
            } else {
                // ✅ FIX: Visual Logic updated for 2 max warnings
                alert(`⚠️ WARNING! Focus lost.\n\nYou have ${res.data.remaining_attempts} attempt(s) left.\nNext violation will terminate the test.`);
            }
        } catch (err) { console.error(err); }
    };

    // 4. LISTENERS
    useEffect(() => {
        if (status !== "active") return;

        const handleVisibility = () => { if (document.hidden) reportViolation(); };
        const handleFullscreen = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                reportViolation();
            } else {
                setIsFullscreen(true);
            }
        };
        const handleContext = (e: any) => e.preventDefault();

        document.addEventListener("visibilitychange", handleVisibility);
        document.addEventListener("fullscreenchange", handleFullscreen);
        document.addEventListener("contextmenu", handleContext);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            document.removeEventListener("fullscreenchange", handleFullscreen);
            document.removeEventListener("contextmenu", handleContext);
        };
    }, [status]);

    const enterFullScreenAndStart = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                setStatus("active");
                setIsFullscreen(true);
            }).catch(() => alert("Fullscreen required."));
        }
    };

    // --- VIEWS ---

    if (status === "waiting") {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-10 text-center">
                <Clock size={64} className="text-[#0088C7] mb-4" />
                <h2 className="text-2xl font-bold">Test Scheduled</h2>
                <div className="text-xl font-bold mt-2 text-[#0088C7]">{new Date(lesson.start_time).toLocaleString()}</div>
            </div>
        );
    }

    if (status === "countdown") {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white p-10 text-center">
                <h2 className="text-3xl font-bold mb-4">Starting Soon</h2>
                <div className="text-7xl font-mono font-bold text-yellow-400">{countdownString}</div>
            </div>
        );
    }

    if (status === "ready") {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-green-50 p-10 text-center">
                <Zap size={64} className="text-green-600 mb-4" />
                <h2 className="text-3xl font-bold mb-4">Test is Live</h2>
                <button onClick={() => setStatus("rules")} className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-all">
                    Start Exam Process
                </button>
            </div>
        );
    }

    if (status === "rules") {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white p-10">
                <div className="max-w-2xl text-center">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold mb-6">⚠️ Strict Rules</h1>
                    <ul className="text-left space-y-4 bg-red-50 p-6 rounded-xl border border-red-200 mb-8 text-slate-800">
                        <li><strong>1. Fullscreen Only:</strong> Exiting triggers a violation.</li>
                        <li><strong>2. No Tab Switching:</strong> Leaving the tab triggers a violation.</li>
                        <li className="text-red-600 font-bold">3. Max 2 Violations: The 3rd strike terminates you immediately.</li>
                    </ul>
                    <button onClick={enterFullScreenAndStart} className="bg-[#0088C7] text-white px-8 py-4 rounded-xl font-bold">
                        I Agree & Start
                    </button>
                </div>
            </div>
        );
    }

    if (status === "terminated") {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-red-50 text-red-900 p-10 text-center border-l-8 border-red-600">
                <AlertCircle size={80} className="text-red-600 mb-6" />
                <h1 className="text-4xl font-extrabold mb-4">TERMINATED</h1>
                <p className="text-xl">You violated the proctoring rules. Access is revoked.</p>
            </div>
        );
    }

    if (status === "expired") {
        return <div className="p-10 text-center text-slate-500 font-bold text-xl">Test has ended.</div>;
    }

    if (status === "active") {
        return (
            <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black flex flex-col">
                {!isFullscreen && (
                    <div className="absolute inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center text-white p-10 text-center">
                        <AlertCircle size={64} className="text-red-500 mb-4 animate-bounce" />
                        <h2 className="text-3xl font-bold text-red-400 mb-2">RETURN TO FULLSCREEN</h2>
                        <div className="mt-6 font-mono font-bold text-2xl text-white bg-red-600 px-6 py-2 rounded">
                            Attempts Remaining: {Math.max(0, 2 - violationCount)}
                        </div>
                        <button onClick={enterFullScreenAndStart} className="mt-8 bg-white text-black px-8 py-3 rounded-lg font-bold">RETURN</button>
                    </div>
                )}

                <div className="h-14 bg-slate-900 border-b border-slate-700 flex justify-between items-center px-6 text-white select-none">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-lg">{lesson.title}</span>
                        <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold animate-pulse border border-red-900 bg-red-900/20 px-2 py-1 rounded"><Radio size={12} /> REC</div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className={`flex items - center gap - 2 text - sm font - bold px - 3 py - 1 rounded ${violationCount > 0 ? 'bg-red-900/50 text-red-200' : 'bg-green-900/30 text-green-400'} `}>
                            <AlertCircle size={16} />
                            Warnings: {violationCount} / 2
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xl font-bold bg-slate-800 px-4 py-1 rounded border border-slate-700">
                            <Clock size={18} className="text-[#0088C7]" /> {testTimerString}
                        </div>
                    </div>
                </div>
                <iframe src={lesson.url} className="flex-1 w-full border-none bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
            </div>
        );
    }

    return <div className="p-10 text-center">Checking Status...</div>;
};

// --- MAIN PLAYER COMPONENT (UNTOUCHED) ---
const CoursePlayer = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeLesson, setActiveLesson] = useState<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedModules, setExpandedModules] = useState<number[]>([]);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
    const [assessmentLink, setAssessmentLink] = useState("");
    const [assessmentStatus, setAssessmentStatus] = useState<{ submitted: boolean; link: string; file_name: string; submitted_at: string } | null>(null);
    const [assessmentUploading, setAssessmentUploading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: "", description: "", price: 0, image_url: "", language: "" });

    // ✅ 1. NEW STATE FOR PAYWALL
    const [isTrialExpired, setIsTrialExpired] = useState(false);
    const [expiredCourseDetails, setExpiredCourseDetails] = useState<{ title: string, price: number } | null>(null);
    const [paywallPromoCode, setPaywallPromoCode] = useState("");
    const [paywallPromoInfo, setPaywallPromoInfo] = useState<{
        final_price: number;
        original_price: number;
        message: string;
        code: string;
    } | null>(null);
    const [paywallProcessing, setPaywallProcessing] = useState(false);
    const handleEditClick = () => {
        if (!course) return;
        setEditForm({ title: course.title || "", description: course.description || "", price: course.price || 0, image_url: course.image_url || "", language: course.language || "" });
        setIsEditing(true);
    };

    const handleSaveChanges = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.patch(`${API_BASE_URL}/courses/${courseId}/details`, editForm, { headers: { Authorization: `Bearer ${token}` } });
            triggerToast("Course Updated Successfully!", "success");
            setIsEditing(false);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) { console.error(err); triggerToast("Failed to update course.", "error"); }
    };

    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const triggerToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };
    const getErrorMessage = (err: any, fallback: string) =>
        err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;

    const brand = { blue: "#0088C7", green: "#8DC63F", textMain: "#0f172a", textLight: "#64748b" };
    const RAZORPAY_PAYLINK_URL = import.meta.env.VITE_RAZORPAY_PAYLINK_URL;

    const applyPaywallPromo = async () => {
        if (!paywallPromoCode.trim() || !courseId) return;
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_BASE_URL}/promo/validate`,
                { code: paywallPromoCode.trim(), course_id: Number(courseId) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPaywallPromoInfo({
                final_price: res.data.final_price,
                original_price: res.data.original_price,
                message: res.data.message,
                code: res.data.code,
            });
            triggerToast(res.data.message || "Promo applied", "success");
        } catch (err: any) {
            setPaywallPromoInfo(null);
            triggerToast(getErrorMessage(err, "Invalid promo code"), "error");
        }
    };

    const openRazorpayPayLink = () => {
        if (!RAZORPAY_PAYLINK_URL) {
            triggerToast("Razorpay payment link is not configured.", "error");
            return;
        }
        window.open(RAZORPAY_PAYLINK_URL, "_blank", "noopener,noreferrer");
    };

    const handlePayment = async () => {
        setPaywallProcessing(true);
        try {
            // ✅ 1. Get the real price (No hardcoded fallback)
            const realPrice = course?.price || expiredCourseDetails?.price;

            // 🛑 SAFETY CHECK: If price is missing, stop here.
            if (!realPrice) {
                triggerToast("Error: Unable to retrieve course price. Please refresh.", "error");
                return;
            }

            const orderUrl = `${API_BASE_URL}/create-order`;
            const token = localStorage.getItem("token");
            const appliedPromo = paywallPromoInfo?.code || paywallPromoCode.trim() || undefined;

            // ✅ 2. Create order for this exact course (amount comes from backend)
            const { data } = await axios.post(
                orderUrl,
                { course_id: Number(courseId), promo_code: appliedPromo },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 100% promo → unlock without Razorpay
            if (data.free) {
                triggerToast(data.message || "Course unlocked with promo!", "success");
                setTimeout(() => window.location.reload(), 1200);
                return;
            }

            const razorpayKey = data.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
            if (!razorpayKey || String(razorpayKey).includes("replace_me")) {
                triggerToast("Set a valid VITE_RAZORPAY_KEY_ID in frontend/.env", "error");
                return;
            }

            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                triggerToast("Razorpay SDK failed to load", "error");
                return;
            }

            const options = {
                key: razorpayKey,
                amount: data.amount,
                currency: data.currency || "INR",
                name: "iQmath Pro",
                description: "Lifetime Course Access",
                order_id: data.id,
                handler: async function (response: any) {
                    try {
                        await axios.post(
                            `${API_BASE_URL}/payment/verify`,
                            {
                                course_id: Number(courseId),
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                promo_code: data.promo_code || appliedPromo,
                            },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        triggerToast(`Payment Successful! ID: ${response.razorpay_payment_id}`, "success");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (enrollErr: any) {
                        triggerToast(getErrorMessage(enrollErr, "Payment succeeded, but unlock failed. Contact support."), "error");
                    }
                },
                theme: { color: "#8DC63F" }
            };
            const rzp1 = new (window as any).Razorpay(options);
            rzp1.open();
        } catch (error: any) {
            console.error(error);
            triggerToast(getErrorMessage(error, "Payment init failed"), "error");
        } finally {
            setPaywallProcessing(false);
        }
    };

    useEffect(() => {
        const fetchCourse = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/player`, { headers: { Authorization: `Bearer ${token}` } });
                setCourse(res.data);

                const modules = res.data.modules || [];
                const allLessons = modules.flatMap((m: any) => m.lessons || []);
                // Prefetch first few YouTube thumbs so the CDN handshake is already done
                allLessons
                    .filter((l: any) => l?.type === "video" || l?.type === "live_class")
                    .slice(0, 4)
                    .forEach((l: any) => prefetchYoutubeWarmup(l.url));

                setActiveLesson((prev: any) => {
                    if (prev?.id) {
                        const updated = allLessons.find((l: any) => l.id === prev.id);
                        return updated || prev;
                    }
                    return modules[0]?.lessons?.[0] || prev;
                });
                setExpandedModules((prev) => {
                    if (prev.length) return prev;
                    return modules[0]?.id ? [modules[0].id] : prev;
                });
            } catch (err: any) {
                console.error(err);

                if (err.response?.status === 402) {
                    setIsTrialExpired(true);
                    // ✅ NEW: Fetch basic details (title/price) since player API failed
                    // We use the public endpoint or a basic endpoint that doesn't require enrollment check if possible, 
                    // or just the generic /courses/{id} endpoint which usually returns basic info.
                    try {
                        const token = localStorage.getItem("token");
                        const basicRes = await axios.get(`${API_BASE_URL}/courses/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
                        setExpiredCourseDetails(basicRes.data);
                    } catch (e) {
                        console.error("Could not fetch course price", e);
                    }
                }
            } finally { setLoading(false); }
        };
        fetchCourse();
    }, [courseId, refreshTrigger]);

    useEffect(() => {
        if (!activeLesson) return;
        // Skip artificial wait for videos — player handles its own brief paint-ready gate
        if (activeLesson.type === "video" || activeLesson.type === "live_class") {
            setIsTransitioning(false);
            prefetchYoutubeWarmup(activeLesson.url);
            return;
        }
        setIsTransitioning(true);
        const timer = setTimeout(() => { setIsTransitioning(false); }, 120);
        return () => clearTimeout(timer);
    }, [activeLesson?.id, activeLesson?.type, activeLesson?.url]);

    const toggleModule = (moduleId: number) => setExpandedModules(prev => prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]);

    const getEmbedUrl = (url: string) => {
        if (!url) return "";
        if (url.includes("docs.google.com/forms")) return url.replace(/\/viewform.*/, "/viewform?embedded=true").replace(/\/view.*/, "/viewform?embedded=true");
        if (url.includes("script.google.com")) return url;
        return url.replace("/view", "/preview");
    };

    const getResourceLinks = (lesson: any): { title: string; link: string }[] => {
        const raw = lesson?.resource_links;
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw
                .map((resource: any) => ({
                    title: String(resource?.title || resource?.link || "").trim(),
                    link: String(resource?.link || resource?.url || "").trim(),
                }))
                .filter((resource: { title: string; link: string }) => resource.title && resource.link);
        }
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((resource: any) => ({
                            title: String(resource?.title || resource?.link || "").trim(),
                            link: String(resource?.link || resource?.url || "").trim(),
                        }))
                        .filter((resource: { title: string; link: string }) => resource.title && resource.link);
                }
            } catch {
                return [];
            }
        }
        return [];
    };

    const plyrOptions = useMemo(() => ({
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        // Regular youtube.com host is faster than nocookie; Plyr chrome/frame unchanged
        youtube: {
            noCookie: false,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
        },
        preload: "metadata" as const,
    }), []);

    const handleAssignmentUpload = async () => {
        if (!assignmentFile) return;
        setUploading(true);
        const token = localStorage.getItem("token");
        try {
            const formData = new FormData();
            formData.append("file", assignmentFile);
            formData.append("lesson_title", activeLesson.title);
            formData.append("lesson_id", activeLesson.id);
            await axios.post(`${API_BASE_URL}/submit-assignment`, formData, {
                headers: { "Authorization": `Bearer ${token}` },
                onUploadProgress: (progressEvent) => { if (progressEvent.total) { const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total); console.log(`Uploading: ${percent}%`); } }
            });
            triggerToast(`✅ Assignment "${assignmentFile.name}" Submitted Successfully!`, "success");
            setAssignmentFile(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) { console.error("Upload Error:", err); triggerToast("❌ Upload Failed. Please try again.", "error"); } finally { setUploading(false); }
    };

    const handleToggleComplete = async (lesson: any) => {
        if (!lesson?.id) return;
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_BASE_URL}/content/${lesson.id}/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const nextCompleted = Boolean(res.data?.is_completed);
            // Keep header + sidebar in sync immediately (don't wait on refetch alone)
            setActiveLesson((prev: any) => (prev?.id === lesson.id ? { ...prev, is_completed: nextCompleted } : prev));
            setCourse((prev: any) => {
                if (!prev?.modules) return prev;
                return {
                    ...prev,
                    modules: prev.modules.map((m: any) => {
                        const lessons = (m.lessons || []).map((l: any) =>
                            l.id === lesson.id ? { ...l, is_completed: nextCompleted } : l
                        );
                        return {
                            ...m,
                            lessons,
                            is_completed: lessons.length > 0 && lessons.every((l: any) => l.is_completed),
                        };
                    }),
                };
            });
            triggerToast(nextCompleted ? "Marked as Complete!" : "Marked as Incomplete", "success");
            setRefreshTrigger((prev) => prev + 1);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            triggerToast(typeof detail === "string" ? detail : "Failed to update status", "error");
        }
    };

    const handleClaimCertificate = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/claim-certificate`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === "success") {
                triggerToast("🎉 Certificate Generated Successfully!", "success");
                // Download PDF immediately
                try {
                    const pdfRes = await axios.get(`${API_BASE_URL}/generate-pdf/${courseId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        responseType: "blob",
                    });
                    const url = window.URL.createObjectURL(new Blob([pdfRes.data]));
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${(course?.title || "course").replace(/\s+/g, "_")}_Certificate.pdf`;
                    link.click();
                    window.URL.revokeObjectURL(url);
                } catch {
                    /* claim succeeded; download can happen from dashboard */
                }
                setTimeout(() => navigate("/student-dashboard"), 2000);
            } else { triggerToast(res.data.message || "Course not yet complete.", "error"); }
        } catch (err: any) {
            triggerToast(err?.response?.data?.message || err?.response?.data?.detail || "Failed to claim certificate.", "error");
        }
    };

    const isCourseFullyComplete = useMemo(() => {
        if (!course) return false;
        return course.modules.every((m: any) => m.lessons.every((l: any) => l.is_completed));
    }, [course]);

    useEffect(() => {
        if (!isCourseFullyComplete || !courseId) return;
        const token = localStorage.getItem("token");
        axios
            .get(`${API_BASE_URL}/courses/${courseId}/assessment`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                setAssessmentStatus(res.data);
                if (res.data?.link) setAssessmentLink(res.data.link);
            })
            .catch(() => setAssessmentStatus(null));
    }, [isCourseFullyComplete, courseId, refreshTrigger]);

    const handleSubmitAssessment = async () => {
        if (!assessmentFile && !assessmentLink.trim()) {
            triggerToast("Upload a file or paste a project link.", "error");
            return;
        }
        setAssessmentUploading(true);
        try {
            const token = localStorage.getItem("token");
            const form = new FormData();
            if (assessmentFile) form.append("file", assessmentFile);
            if (assessmentLink.trim()) form.append("link", assessmentLink.trim());
            const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/assessment`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAssessmentStatus(res.data);
            setAssessmentFile(null);
            triggerToast("Assessment submitted!", "success");
            setRefreshTrigger((prev) => prev + 1);
        } catch (err: any) {
            triggerToast(err?.response?.data?.detail || "Assessment submit failed.", "error");
        } finally {
            setAssessmentUploading(false);
        }
    };

    const renderContent = () => {
        if (!activeLesson) return <div className="text-white p-10 text-center">Select a lesson</div>;
        if (isTransitioning) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                    <div className="w-10 h-10 border-4 border-[#0088C7] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-bold tracking-wider animate-pulse text-slate-400">LOADING...</p>
                </div>
            );
        }

        const completionHeader = (
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">{activeLesson.title}</h3>
                <div onClick={() => handleToggleComplete(activeLesson)} className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all border ${activeLesson.is_completed ? "bg-green-100 border-green-300 text-green-700" : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"}`}>
                    {activeLesson.is_completed ? <CheckSquare size={20} /> : <Square size={20} />}
                    <span className="text-sm font-bold">{activeLesson.is_completed ? "Completed" : "Mark as Complete"}</span>
                </div>
            </div>
        );

        let contentBody = null;
        if (activeLesson.type === "note") {
            contentBody = (<div className="w-full h-full relative"><iframe src={getEmbedUrl(activeLesson.url)} width="100%" height="100%" className="bg-white border-0" allow="autoplay" /><div style={{ position: "absolute", top: 0, right: 0, width: "65px", height: "60px", background: "#202124", zIndex: 50 }}></div></div>);
        }
        else if (activeLesson.type === "quiz") contentBody = (<div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-4"><iframe src={getEmbedUrl(activeLesson.url)} width="100%" height="100%" frameBorder="0" className="rounded-xl shadow-sm border border-slate-200 bg-white max-w-4xl" allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">Loading...</iframe></div>);
        else if (activeLesson.type === "video" || activeLesson.type === "live_class") {
            const resourceLinks = getResourceLinks(activeLesson);
            contentBody = (
                <div className="h-full overflow-y-auto bg-slate-100 p-4 lg:p-6">
                    <div className="max-w-5xl mx-auto bg-black rounded-xl overflow-hidden shadow-xl">
                        <DelayedVideoPlayer key={activeLesson.id} lesson={activeLesson} plyrOptions={plyrOptions} />
                    </div>
                    {resourceLinks.length > 0 && (
                        <div className="max-w-5xl mx-auto mt-4 bg-white border border-slate-200 rounded-xl p-4">
                            <div className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wide">Resources</div>
                            <div className="flex flex-col gap-2">
                                {resourceLinks.map((resource: { title: string; link: string }, idx: number) => (
                                    <div
                                        key={`${activeLesson.id}-resource-${idx}`}
                                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <ResourceLinkIcon size={15} />
                                            {resource.title}
                                        </div>
                                        <a
                                            href={resource.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 block text-xs text-[#0088C7] hover:text-[#006FA3] hover:underline break-all"
                                        >
                                            {resource.link}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        else if (activeLesson.type === "live_test") contentBody = <LiveTestProctor lesson={activeLesson} />;
        else if (activeLesson.type === "code_test") contentBody = <CodeCompiler lesson={activeLesson} />;
        else if (activeLesson.type === "assignment") {
            contentBody = (
                <div className="flex flex-col items-center justify-center h-full bg-[#F8FAFC] p-8 font-sans text-slate-800">
                    <div className="bg-white p-10 rounded-2xl shadow-xl max-w-2xl w-full text-center border border-slate-100">
                        {activeLesson.is_completed ? (
                            <div className="flex flex-col items-center animate-fade-in-up">
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle size={48} className="text-green-600" />
                                </div>
                                <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Assignment Submitted!</h2>
                                <p className="text-slate-500 mb-8 text-lg">
                                    You have successfully submitted this assignment.<br />
                                    Your instructor will review it shortly.
                                </p>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full flex items-center justify-center gap-2 text-green-800 font-bold">
                                    <CheckCheck size={20} />
                                    <span>Submission Recorded</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><UploadCloud size={40} className="text-[#0088C7]" /></div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">{activeLesson.title}</h2>
                                {activeLesson.is_mandatory && (<span className="inline-block bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-4">MANDATORY SUBMISSION</span>)}
                                <p className="text-slate-600 mb-8 leading-relaxed whitespace-pre-wrap text-sm">{activeLesson.instructions || activeLesson.description || "Upload your assignment below."}</p>
                                <div className="mb-8">
                                    {!assignmentFile ? (
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer relative group">
                                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.zip" />
                                            <div className="flex flex-col items-center gap-3 group-hover:scale-105 transition-transform"><UploadCloud size={32} className="text-slate-400 group-hover:text-[#0088C7]" /><div><p className="text-slate-700 font-bold text-sm">Click to upload or drag and drop</p><p className="text-slate-400 text-xs mt-1">Maximum file size 10MB</p></div></div>
                                        </div>
                                    ) : (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4"><div className="bg-white p-2 rounded-lg border border-blue-100 text-[#0088C7]"><FileIcon size={24} /></div><div className="text-left"><p className="text-slate-800 font-bold text-sm truncate max-w-[200px]">{assignmentFile.name}</p><p className="text-slate-500 text-xs">{(assignmentFile.size / 1024 / 1024).toFixed(2)} MB</p></div></div>
                                            <button onClick={() => setAssignmentFile(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500"><X size={20} /></button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleAssignmentUpload} disabled={!assignmentFile || uploading} className="w-full py-4 bg-[#0088C7] hover:bg-[#006FA3] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {uploading ? "Uploading to Drive..." : "Submit Assignment"} {!uploading && <CheckCircle size={20} />}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            );
        }
        else contentBody = <div className="p-10 text-center">Unknown Content Type</div>;

        return (<div className="flex flex-col h-full">{completionHeader}<div className="flex-1 overflow-hidden relative">{contentBody}</div></div>);
    };

    const coursePrice = Number(course?.price ?? expiredCourseDetails?.price ?? 0);
    const isFreeCourse = coursePrice <= 0;

    // ✅ 3. PAYWALL VIEW: Renders if trial is expired
    if (isTrialExpired) {
        // Use the fetched details, or fallbacks if loading failed
        const displayPrice = expiredCourseDetails?.price || 599;
        const originalPrice = Math.round(displayPrice * 1.5); // Fake "original" price for effect

        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
                <ToastNotification toast={toast} setToast={setToast} />

                {/* ✅ FIXED BACK BUTTON: Added z-50 to ensure it's on top */}
                <button
                    onClick={() => navigate("/student-dashboard")}
                    className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors z-50 cursor-pointer"
                >
                    <ArrowLeft size={20} /> Back to Dashboard
                </button>

                <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md w-full border border-slate-200 animate-fade-in-up relative z-10">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isFreeCourse ? "bg-green-100" : "bg-red-100"}`}>
                        <LockKeyhole size={40} className={isFreeCourse ? "text-green-600" : "text-red-500"} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
                        {isFreeCourse ? "Free Course" : "Trial Expired"}
                    </h1>
                    <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                        {isFreeCourse ? (
                            <>
                                <strong>{expiredCourseDetails?.title || "This course"}</strong> is free.
                                <br />
                                Enroll to continue learning — no payment needed.
                            </>
                        ) : (
                            <>
                                Your 7-day free trial for <strong>{expiredCourseDetails?.title || "this course"}</strong> has ended.
                                <br />
                                Unlock lifetime access to continue learning.
                            </>
                        )}
                    </p>

                    {isFreeCourse ? (
                        <button
                            type="button"
                            disabled={paywallProcessing}
                            onClick={async () => {
                                setPaywallProcessing(true);
                                try {
                                    const token = localStorage.getItem("token");
                                    await axios.post(
                                        `${API_BASE_URL}/enroll/${courseId}`,
                                        { type: "paid" },
                                        { headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    triggerToast("Enrolled! Reloading…", "success");
                                    setTimeout(() => window.location.reload(), 1000);
                                } catch (err: any) {
                                    triggerToast(getErrorMessage(err, "Enrollment failed"), "error");
                                } finally {
                                    setPaywallProcessing(false);
                                }
                            }}
                            className="w-full py-3.5 bg-[#8DC63F] hover:bg-[#6FA32E] disabled:opacity-60 text-white rounded-xl font-bold text-lg transition-all"
                        >
                            {paywallProcessing ? "Enrolling..." : "Enroll Free"}
                        </button>
                    ) : (
                        <>
                            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Price</p>
                                <p className="text-3xl font-extrabold text-slate-900">
                                    {paywallPromoInfo ? (
                                        <>
                                            ₹{paywallPromoInfo.final_price}{" "}
                                            <span className="text-lg font-medium text-slate-400 line-through">
                                                ₹{paywallPromoInfo.original_price}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            ₹{displayPrice}{" "}
                                            <span className="text-lg font-medium text-slate-400 line-through">₹{originalPrice}</span>
                                        </>
                                    )}
                                </p>
                            </div>

                            <div className="mb-4 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Promo code"
                                    value={paywallPromoCode}
                                    onChange={(e) => {
                                        setPaywallPromoCode(e.target.value);
                                        setPaywallPromoInfo(null);
                                    }}
                                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#8DC63F]"
                                />
                                <button
                                    type="button"
                                    onClick={applyPaywallPromo}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    Apply
                                </button>
                            </div>
                            {paywallPromoInfo && (
                                <p className="text-xs text-green-700 font-semibold mb-4 -mt-2">{paywallPromoInfo.message}</p>
                            )}

                            <button
                                onClick={handlePayment}
                                disabled={paywallProcessing}
                                className="w-full py-3.5 bg-[#8DC63F] hover:bg-[#6FA32E] disabled:opacity-60 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-200 hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <CreditCard size={20} />
                                {paywallProcessing
                                    ? "Processing..."
                                    : paywallPromoInfo?.final_price === 0
                                      ? "Unlock Free with Promo"
                                      : "Buy Lifetime Access"}
                            </button>
                            {RAZORPAY_PAYLINK_URL && (
                                <button
                                    type="button"
                                    onClick={openRazorpayPayLink}
                                    className="w-full mt-3 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
                                >
                                    Pay via Razorpay Link
                                </button>
                            )}
                            <p className="text-[10px] text-slate-400 mt-4">Secure payment via Razorpay</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (loading) return <div>Loading...</div>;
    if (course?.course_type === "coding") return <CodingPlayer course={course} token={localStorage.getItem("token") || ""} />;

    return (
        <div className="flex h-screen w-screen overflow-hidden font-sans bg-slate-900 relative">
            <ToastNotification toast={toast} setToast={setToast} />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full relative z-0">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 justify-between z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/student-dashboard")} className="bg-none border-none cursor-pointer text-slate-500 flex items-center gap-2 font-semibold hover:text-slate-800 text-xs lg:text-sm"><ChevronLeft size={20} /> <span className="hidden sm:inline">Dashboard</span></button>
                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                        <h1 className="text-sm lg:text-base font-bold text-slate-900 m-0 max-w-[200px] lg:max-w-[400px] truncate">{course?.title || activeLesson?.title || "Course Player"}</h1>
                    </div>
                    <div className="flex items-center gap-2 lg:gap-4">
                        {localStorage.getItem("role") === "instructor" && (<button onClick={handleEditClick} className="hidden lg:flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold border border-slate-200 hover:bg-slate-200 transition-colors text-sm"><Edit size={16} /> Edit Course</button>)}
                        {!isFreeCourse && (
                            <button onClick={handlePayment} className="hidden sm:flex items-center gap-2 bg-[#8DC63F] text-white px-4 py-2 rounded-lg font-bold border-none cursor-pointer hover:bg-[#6FA32E] transition-colors text-xs lg:text-sm"><CreditCard size={18} /> Buy Lifetime Access</button>
                        )}
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-none border-none cursor-pointer p-2 hover:bg-slate-100 rounded-lg"><Menu color={brand.textMain} size={24} /></button>
                    </div>
                </header>
                <div className="flex-1 bg-white relative overflow-hidden">{renderContent()}</div>
            </div>

            {/* SIDEBAR - Responsive Overlay on Mobile, Fixed Width on Desktop */}
            {sidebarOpen && (
                <aside className="fixed inset-0 z-50 lg:static lg:z-auto lg:w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl lg:shadow-none">
                    <div className="p-4 lg:p-6 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest m-0">Course Content</h2>
                        {/* Mobile Close Button */}
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-800">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        {course?.modules.map((module: any, idx: number) => {
                            const isModuleComplete = module.lessons.length > 0 && module.lessons.every((l: any) => l.is_completed);
                            return (
                                <div key={module.id} className="border-b border-slate-100">
                                    <div onClick={() => toggleModule(module.id)} className={`p-4 cursor-pointer flex justify-between items-center transition-colors ${isModuleComplete ? "bg-blue-50/50" : "bg-slate-50 hover:bg-slate-100"}`}>
                                        <div className="flex items-center gap-3">
                                            {isModuleComplete ? (<div className="bg-blue-100 rounded-full p-1 text-[#0088C7]"><CheckCheck size={18} strokeWidth={3} /></div>) : (<div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</div>)}
                                            <div><div className={`text-[11px] font-bold uppercase ${isModuleComplete ? "text-[#0088C7]" : "text-slate-500"}`}>{isModuleComplete ? "Completed" : `Section ${idx + 1}`}</div><div className={`text-sm font-semibold ${module.is_completed ? "text-slate-400 line-through" : "text-slate-800"}`}>{module.title}</div></div>
                                        </div>
                                        {expandedModules.includes(module.id) ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                                    </div>
                                    {expandedModules.includes(module.id) && (
                                        <div className="animate-fade-in">
                                            {module.lessons.map((lesson: any) => {
                                                const isActive = activeLesson?.id === lesson.id;
                                                return (
                                                    <div
                                                        key={lesson.id}
                                                        onClick={() => { setActiveLesson(lesson); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                                        className={`flex items-center gap-3 p-3 pl-12 cursor-pointer border-l-4 transition-all ${isActive ? 'bg-blue-50 border-blue-600' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                                    >
                                                        <div className={isActive ? "text-blue-600" : "text-slate-400"}>
                                                            {lesson.is_completed ? (<CheckCircle size={16} className="text-[#8DC63F]" fill="#ecfccb" />) : (
                                                                <>
                                                                    {lesson.type.includes("video") && <PlayCircle size={16} />}
                                                                    {lesson.type === "note" && <FileText size={16} />}
                                                                    {lesson.type === "quiz" && <HelpCircle size={16} />}
                                                                    {lesson.type.includes("code") && <Code size={16} />}
                                                                    {lesson.type === "assignment" && <UploadCloud size={16} />}
                                                                    {lesson.type === "live_class" && <Radio size={16} />}
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className={`text-sm flex-1 ${isActive ? "text-blue-600 font-semibold" : "text-slate-600"} ${lesson.is_completed ? "line-through text-slate-400 decoration-slate-300" : ""}`}>{lesson.title}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ✅ 8. Assessment + Certificate */}
                    <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
                        {isCourseFullyComplete && (
                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase">Course assessment</p>
                                {assessmentStatus?.submitted ? (
                                    <p className="text-xs text-green-700 font-semibold">
                                        Submitted {assessmentStatus.submitted_at}
                                        {assessmentStatus.file_name ? ` · ${assessmentStatus.file_name}` : ""}
                                    </p>
                                ) : (
                                    <p className="text-xs text-amber-700">Submit a file and/or project link to unlock your certificate.</p>
                                )}
                                <input
                                    type="url"
                                    placeholder="https://… project link"
                                    value={assessmentLink}
                                    onChange={(e) => setAssessmentLink(e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2"
                                />
                                <input
                                    type="file"
                                    accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                                    onChange={(e) => setAssessmentFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={handleSubmitAssessment}
                                    disabled={assessmentUploading}
                                    className="w-full py-2 rounded-lg bg-slate-800 text-white text-xs font-bold"
                                >
                                    {assessmentUploading ? "Submitting…" : assessmentStatus?.submitted ? "Resubmit assessment" : "Submit assessment"}
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleClaimCertificate}
                            disabled={!isCourseFullyComplete || !assessmentStatus?.submitted}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isCourseFullyComplete && assessmentStatus?.submitted ? "bg-[#0088C7] text-white shadow-lg shadow-blue-200 hover:scale-105 cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                        >
                            <Award size={20} />
                            {!isCourseFullyComplete
                                ? "Complete All Modules"
                                : !assessmentStatus?.submitted
                                    ? "Submit Assessment First"
                                    : "Claim Certificate"}
                        </button>
                    </div>
                </aside>
            )}
            {/* ✅ NEW: EDIT COURSE MODAL */}
            {isEditing && (
                <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <Edit size={18} className="text-[#0088C7]" /> Edit Course Details
                            </h3>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Course Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088C7]"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0088C7]"
                                />
                            </div>

                            <div className="flex gap-4">
                                {/* Price */}
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price (INR)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={editForm.price}
                                            onChange={e => setEditForm({ ...editForm, price: parseInt(e.target.value) })}
                                            className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088C7]"
                                        />
                                    </div>
                                </div>

                                {/* Language */}
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Language</label>
                                    <select
                                        value={editForm.language}
                                        onChange={e => setEditForm({ ...editForm, language: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088C7]"
                                    >
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                        <option value="javascript">JavaScript</option>
                                    </select>
                                </div>
                            </div>

                            {/* Thumbnail */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thumbnail URL</label>
                                <input
                                    type="text"
                                    value={editForm.image_url}
                                    onChange={e => setEditForm({ ...editForm, image_url: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0088C7]"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleSaveChanges} className="flex-1 py-3 rounded-xl font-bold bg-[#0088C7] text-white hover:bg-[#006FA3] shadow-lg shadow-blue-200 transition-all">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoursePlayer;