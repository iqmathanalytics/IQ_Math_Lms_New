import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { FileText,  PlusCircle, BookOpen, Trash2, CheckCircle,  X, AlertTriangle, Share2, Eye } from "lucide-react"; // ✅ Added Icons
import API_BASE_URL from './config';
import AdminLogin from "./AdminLogin";
import Login from "./Login";
import LandingPage from "./LandingPage"; 
import DashboardLayout from "./DashboardLayout";
import CreateCourse from "./CreateCourse";
import CourseBuilder from "./CourseBuilder";
import AssignmentManager from "./AssignmentManager";
import StudentDashboard from "./StudentDashboard"; 
import CoursePlayer from "./CoursePlayer"; 
import AddAdmits from "./AddAdmits"; 
import CoursePreview from "./CoursePreview";
import CodeArena from "./CodeArena"; 
import Dashboard from "./Dashboard"; 
import InstructorSettings from "./InstructorSettings"; 
import StudentManagement from "./StudentManagement";
import Messages from "./Messages";
import CodingCourseManager from "./CodingCourseManager";
import CertificateDesk from "./admin/CertificateDesk";
import PromoDesk from "./admin/PromoDesk";
import SharedCourse from "./SharedCourse";
import FastImage from "./components/FastImage";
import { FallbackRoute, ProtectedRoute, PublicOnlyRoute } from "./components/AuthRedirect";
import { authHeaders, clearSession, getValidSession } from "./utils/session";
import { prefetchImages } from "./utils/imageUrl";
// --- Modified CourseList Component ---
const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ NEW: Toast State for Professional Notifications
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ 
    show: false, message: "", type: "success" 
  });

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const fetchCourses = async () => {
      const session = getValidSession();
      if (!session?.token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() });
        setCourses(res.data);
        prefetchImages((res.data || []).map((c: any) => c.image_url), 480);
      } catch (err: any) {
        if (err.response?.status === 401) { clearSession(); window.location.href = "/admin-login"; }
      } finally { setLoading(false); }
    };
    fetchCourses();
  }, []);

  const handleShareCourse = async (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/share/courses/${course.id}`;
    if (!course.is_published) {
      triggerToast("Link ready, but course is unpublished (public page returns 404 until published).", "error");
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: course.title, text: `View curriculum: ${course.title}`, url });
        triggerToast("Share sheet opened", "success");
      } else {
        await navigator.clipboard.writeText(url);
        triggerToast("Share link copied!", "success");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        triggerToast("Share link copied!", "success");
      } catch {
        triggerToast("Could not share link", "error");
      }
    }
  };

  // ✅ UPDATED: Handle Delete Course with Toast Feedback
  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation(); 
    
    // Note: For critical deletes, a native confirm is acceptable, 
    // but the Success/Failure messages must be professional Toasts.
    if (!window.confirm("Are you sure you want to delete this course? This cannot be undone.")) return;

    try {
        await axios.delete(`${API_BASE_URL}/courses/${courseId}`, {
         headers: authHeaders()
        });
        
        // Remove from UI immediately
        setCourses(courses.filter((c: any) => c.id !== courseId));
        
        // ✅ Professional Success Message
        triggerToast("Course deleted successfully!", "success");
    } catch (err) {
        // ✅ Professional Error Message (Replaced Alert)
        triggerToast("Failed to delete course. Ensure no students are enrolled.", "error");
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;
  
  return (
    <div style={{ animation: "fadeIn 0.5s ease", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: 0 }}>My Courses</h2>
            <p style={{ color: "#64748b", margin: "4px 0 0 0" }}>Manage your curriculum.</p>
        </div>
        <button onClick={() => navigate("/dashboard/create-course")} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0088C7", color: "white", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: "600", cursor: "pointer" }}><PlusCircle size={18} /> Create New Course</button>
      </div>
      
      {courses.length === 0 ? ( 
        <div style={{ textAlign: "center", padding: "80px", background: "white", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
            <h3 style={{ color: "#1e293b", margin: "0 0 8px 0" }}>No courses found</h3>
        </div> 
      ) : ( 
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
            {courses.map((course: any) => (
                <div key={course.id} style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s", position: "relative" }} onClick={() => navigate(`/dashboard/course/${course.id}/builder`)}>
                    <div style={{ height: "160px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        {course.image_url ? (
                          <FastImage src={course.image_url} alt={course.title} widthHint={480} className="w-full h-full object-cover absolute inset-0" skeletonClassName="w-full h-full absolute inset-0" />
                        ) : (
                          <FileText size={48} color="#cbd5e1" />
                        )}
                    </div>
                    
                    <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</h4>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: course.is_published ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
                            {course.is_published ? "Published" : "Unpublished"}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); window.open(`/share/courses/${course.id}`, "_blank"); }}
                            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#0088C7" }}
                            title="Preview share"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={(e) => handleShareCourse(e, course)}
                            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#16a34a" }}
                            title="Share course"
                        >
                            <Share2 size={16} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteCourse(e, course.id)}
                            style={{ 
                                background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", 
                                padding: "8px", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                            title="Delete Course"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    </div>
                </div>
            ))}
        </div> 
      )}

      {/* ✅ TOAST NOTIFICATION COMPONENT */}
      {toast.show && (
        <div style={{ 
            position: "fixed", top: "20px", right: "20px", 
            background: "white", padding: "16px 24px", borderRadius: "12px", 
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.15)", 
            borderLeft: `6px solid ${toast.type === "success" ? "#8DC63F" : "#ef4444"}`,
            display: "flex", alignItems: "center", gap: "12px", zIndex: 9999,
            animation: "slideIn 0.3s ease-out"
        }}>
            {toast.type === "success" ? <CheckCircle size={24} color="#8DC63F" /> : <AlertTriangle size={24} color="#ef4444" />}
            <div>
                <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                    {toast.type === "success" ? "Success" : "Error"}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px", color: "#94a3b8" }}>
                <X size={16} />
            </button>
        </div>
      )}
    </div>
  );
};

/** Vite BASE_URL is '/' locally and '/lms/' in production builds. */
const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

function App() {
  return (
    <Router basename={routerBasename}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/admin-login" element={<PublicOnlyRoute><AdminLogin /></PublicOnlyRoute>} />
        <Route path="/share/courses/:courseId" element={<SharedCourse />} />

        <Route path="/dashboard" element={<ProtectedRoute requiredRole="instructor"><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} /> 
          <Route path="courses" element={<CourseList />} />
          <Route path="create-course" element={<CreateCourse />} />
          <Route path="course/:courseId/builder" element={<CourseBuilder />} />
          <Route path="assignments" element={<AssignmentManager />} />
          <Route path="certificates" element={<CertificateDesk />} />
          <Route path="promo-codes" element={<PromoDesk />} />
          <Route path="add-admits" element={<AddAdmits />} />
          <Route path="course/:courseId/preview" element={<CodingCourseManager />} />
          <Route path="course/:courseId/CoursePreview" element={<CoursePreview />} />
          <Route path="code-arena" element={<CodeArena />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="settings" element={<InstructorSettings />} />
          <Route path="messages" element={<Messages />} />
        </Route>
        
        <Route path="/student-dashboard" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/course/:courseId/player" element={<ProtectedRoute requiredRole="student"><CoursePlayer /></ProtectedRoute>} />
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </Router>
  );
}

export default App;