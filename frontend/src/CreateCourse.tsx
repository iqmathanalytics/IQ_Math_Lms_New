import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from './config';
import { Save, Image as ImageIcon, IndianRupee, ArrowLeft, Clock, CheckCircle, AlertCircle, X } from "lucide-react";

const CreateCourse = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "", description: "", price: "", image_url: "", duration: "",
    course_type: "standard", language: "python"
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [isFree, setIsFree] = useState(false);

  const triggerToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type: type as "success" | "error" });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 4000);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("token");
    const finalDescription = formData.duration ? `${formData.description}\n\n[Duration: ${formData.duration}]` : formData.description;

    const payload = {
      title: formData.title,
      description: finalDescription,
      price: isFree ? 0 : parseInt(formData.price),
      image_url: formData.image_url,
      course_type: formData.course_type,
      language: formData.course_type === "coding" ? formData.language : null
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/courses`, payload, { headers: { Authorization: `Bearer ${token}` } });
      triggerToast("Course Created Successfully! Redirecting...", "success");

      setTimeout(() => {
        navigate(`/dashboard/course/${response.data.id}/builder`);
      }, 250);

    } catch (error: any) {
      console.error(error);
      triggerToast("Failed to create course. Please try again.", "error");
    } finally {
      if (!toast.show) setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] mb-2">Create New Course</h2>
          <p className="text-slate-500 text-sm md:text-base">Set up your course details to begin building your curriculum.</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/courses")}
          className="self-start md:self-auto flex items-center gap-2 text-[#0088C7] font-bold hover:underline bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft size={18} strokeWidth={2.5} /> Back to Courses
        </button>
      </div>

      {/* TOAST NOTIFICATION UI */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 bg-white p-4 rounded-xl shadow-2xl border-l-4 flex items-center gap-3 animate-slide-in ${toast.type === "success" ? "border-green-500" : "border-red-500"}`}>
          {toast.type === "success" ? <CheckCircle size={24} className="text-green-500" /> : <AlertCircle size={24} className="text-red-500" />}
          <div>
            <h4 className="font-bold text-[#1e293b] text-sm mb-0.5">{toast.type === "success" ? "Success" : "Error"}</h4>
            <p className="text-xs text-slate-500 m-0">{toast.message}</p>
          </div>
          <button onClick={() => setToast({ ...toast, show: false })} className="ml-2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"><X size={16} /></button>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-[#F8FAFC] p-6 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 md:gap-8">

          {/* Select Course Type */}
          <div className="bg-slate-100 p-5 md:p-6 rounded-xl">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Select Course Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setFormData({ ...formData, course_type: "standard" })}
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.course_type === "standard" ? "bg-white border-[#0088C7] shadow-sm" : "bg-transparent border-slate-300 hover:border-slate-400"}`}>
                <div className={`w-5 h-5 min-w-[20px] rounded-full border-2 border-slate-300 ${formData.course_type === "standard" ? "bg-[#0088C7] border-[#0088C7]" : "bg-transparent"}`} />
                <div>
                  <div className="font-bold text-[#1e293b]">Standard Course</div>
                  <div className="text-xs text-slate-500 mt-1">Video, PDF, Quizzes & Assignments</div>
                </div>
              </div>

              <div onClick={() => setFormData({ ...formData, course_type: "coding" })}
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${formData.course_type === "coding" ? "bg-white border-[#10b981] shadow-sm" : "bg-transparent border-slate-300 hover:border-slate-400"}`}>
                <div className={`w-5 h-5 min-w-[20px] rounded-full border-2 border-slate-300 ${formData.course_type === "coding" ? "bg-[#10b981] border-[#10b981]" : "bg-transparent"}`} />
                <div>
                  <div className="font-bold text-[#1e293b]">Coding Course</div>
                  <div className="text-xs text-slate-500 mt-1">Practice Problems with Compiler</div>
                </div>
              </div>
            </div>

            {/* SHOW LANGUAGE ONLY IF CODING COURSE */}
            {formData.course_type === "coding" && (
              <div className="mt-5 animate-fade-in">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Programming Language</label>
                <div className="relative">
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full p-3 pl-4 text-sm rounded-lg border border-slate-300 bg-white outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all appearance-none"
                  >
                    <option value="python">Python (3.8.1)</option>
                    <option value="java">Java (OpenJDK 13)</option>
                    <option value="cpp">C++ (GCC 9.2)</option>
                    <option value="javascript">JavaScript (Node.js)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Course Title</label>
            <input
              type="text"
              placeholder="e.g. Advanced Java Masterclass"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full p-3 text-sm rounded-lg border border-slate-300 focus:border-[#0088C7] focus:ring-1 focus:ring-[#0088C7] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Syllabus / Description PDF Link</label>
            <input
              type="text"
              placeholder="Paste Google Drive Link to PDF..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full p-3 text-sm rounded-lg border border-slate-300 focus:border-[#0088C7] focus:ring-1 focus:ring-[#0088C7] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Total Course Duration</label>
            <div className="relative">
              <Clock size={16} className="absolute left-3.5 top-3.5 text-slate-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="e.g. 12 Hours 30 Mins"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full p-3 pl-10 text-sm rounded-lg border border-slate-300 focus:border-[#0088C7] focus:ring-1 focus:ring-[#0088C7] outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Price (INR)</label>
              <div className="relative">
                <IndianRupee size={16} className={`absolute left-3.5 top-3.5 ${isFree ? "text-slate-300" : "text-slate-400"}`} strokeWidth={1.5} />
                <input
                  type="number"
                  placeholder="999"
                  value={isFree ? 0 : formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required={!isFree}
                  disabled={isFree}
                  className={`w-full p-3 pl-10 text-sm rounded-lg border outline-none transition-all ${isFree ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white text-slate-800 border-slate-300 focus:border-[#0088C7] focus:ring-1 focus:ring-[#0088C7]"}`}
                />
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="freeCourse"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-[#0088C7]"
                />
                <label htmlFor="freeCourse" className="text-xs font-bold text-slate-500 cursor-pointer select-none">Set as <strong className="text-slate-700">Free Course</strong></label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Thumbnail URL</label>
              <div className="relative">
                <ImageIcon size={16} className="absolute left-3.5 top-3.5 text-slate-400" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="https://image-link.com/photo.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full p-3 pl-10 text-sm rounded-lg border border-slate-300 focus:border-[#0088C7] focus:ring-1 focus:ring-[#0088C7] outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate("/dashboard/courses")}
              className="px-6 py-3 rounded-xl border border-slate-300 bg-white text-slate-500 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl border-none bg-[#0088C7] text-white font-bold shadow-lg shadow-blue-500/20 hover:bg-[#006FA3] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Save size={18} /> {loading ? "Creating..." : "Create & Build Curriculum"}
            </button>
          </div>

        </form>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default CreateCourse;