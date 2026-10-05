import { useEffect, useState } from "react";
import axios from "axios";
import { Award, Download, ExternalLink, RefreshCw, Save } from "lucide-react";
import API_BASE_URL from "../config";
import { authHeaders } from "../utils/session";

type CertRow = {
  id: number;
  student_name: string;
  email: string;
  course_id: number;
  course_title: string;
  certificate_id: string;
  issued_at: string;
};

type CourseIdSettings = {
  course_id: number;
  title: string;
  prefix: string;
  code: string;
  number_width: number;
  start_number: number;
  preview: string;
};

type AssessmentRow = {
  id: number;
  student_name: string;
  email: string;
  file_name: string;
  link: string;
  submitted_at: string;
};

const CertificateDesk = () => {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [courses, setCourses] = useState<CourseIdSettings[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [form, setForm] = useState({ prefix: "IQ", code: "XXX", number_width: 3, start_number: 1 });
  const [preview, setPreview] = useState("");
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  

  const resetAllStartsToOne = async () => {
    try {
      await axios.post(`${API_BASE_URL}/admin/certificate-id-courses/reset-start`, {}, { headers: authHeaders() });
      setToast("All courses saved: certificate IDs start at 1");
      await load();
    } catch (err: any) {
      setToast(err?.response?.data?.detail || "Failed to reset start numbers");
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      // Load in parallel but independently so one failure doesn't blank the course list
      const [cRes, idRes, optionsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/admin/certificates`, { headers: authHeaders() }),
        axios.get(`${API_BASE_URL}/admin/certificate-id-courses`, { headers: authHeaders() }),
        axios.get(`${API_BASE_URL}/admin/course-options`, { headers: authHeaders() }),
      ]);

      if (cRes.status === "fulfilled") {
        setCerts(cRes.value.data || []);
      }

      let courseRows: CourseIdSettings[] = [];
      if (idRes.status === "fulfilled" && Array.isArray(idRes.value.data) && idRes.value.data.length) {
        courseRows = idRes.value.data;
      } else if (optionsRes.status === "fulfilled" && Array.isArray(optionsRes.value.data)) {
        // Fallback: same course options used by Promo desk / My Courses
        courseRows = (optionsRes.value.data || []).map((c: any) => {
          const id = Number(c.id ?? c.course_id);
          const title = String(c.title || `Course #${id}`);
          const code = (title.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CRS").padEnd(3, "X");
          return {
            course_id: id,
            title,
            prefix: "IQ",
            code,
            number_width: 3,
            start_number: 1,
            preview: `IQ-${code}-001`,
          };
        });
      }
      setCourses(courseRows);

      if (courseRows.length && (selectedCourseId === "" || !courseRows.some((c) => c.course_id === selectedCourseId))) {
        const first = courseRows[0];
        setSelectedCourseId(first.course_id);
        setForm({
          prefix: first.prefix,
          code: first.code,
          number_width: first.number_width,
          start_number: first.start_number,
        });
        setPreview(first.preview);
      }

      if (idRes.status === "rejected" && optionsRes.status === "rejected") {
        setToast("Failed to load courses for certificate IDs");
      }
    } catch {
      setToast("Failed to load certificate desk");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setAssessments([]);
      return;
    }
    const course = courses.find((c) => c.course_id === selectedCourseId);
    if (course) {
      setForm({
        prefix: course.prefix,
        code: course.code,
        number_width: course.number_width,
        start_number: course.start_number,
      });
      setPreview(course.preview);
    }
    axios
      .get(`${API_BASE_URL}/instructor/courses/${selectedCourseId}/assessments`, { headers: authHeaders() })
      .then((res) => setAssessments(res.data || []))
      .catch(() => setAssessments([]));
  }, [selectedCourseId, courses]);

  const saveSettings = async () => {
    if (!selectedCourseId) return;
    try {
      const res = await axios.put(
        `${API_BASE_URL}/admin/courses/${selectedCourseId}/certificate-id`,
        form,
        { headers: authHeaders() }
      );
      setPreview(res.data.preview);
      setToast("Certificate ID settings saved");
      load();
    } catch (err: any) {
      setToast(err?.response?.data?.detail || "Failed to save settings");
    }
  };

  const downloadFile = async (fileName: string) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/instructor/assessments/file/${fileName}`, {
        headers: authHeaders(),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast("Download failed");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading certificates…</div>;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-[#0088C7]" /> Certificates
          </h1>
          <p className="text-slate-500 text-sm">Issued credentials, ID templates, and assessment review.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={resetAllStartsToOne}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#0088C7]/30 bg-[#0088C7]/5 text-sm font-semibold text-[#0088C7] hover:bg-[#0088C7]/10"
          >
            <Save size={16} /> Start all from 1
          </button>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 shadow-sm">
          {toast}
          <button className="ml-3 text-slate-400" onClick={() => setToast("")}>×</button>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-slate-800">Certificate ID template</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Course</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 min-w-[220px]"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>{c.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Prefix</span>
            <input className="border border-slate-200 rounded-lg px-3 py-2 w-24" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</span>
            <input className="border border-slate-200 rounded-lg px-3 py-2 w-24" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Width</span>
            <input type="number" min={1} max={8} className="border border-slate-200 rounded-lg px-3 py-2 w-20" value={form.number_width} onChange={(e) => setForm({ ...form, number_width: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Start number</span>
            <input type="number" min={1} className="border border-slate-200 rounded-lg px-3 py-2 w-28" value={form.start_number} onChange={(e) => setForm({ ...form, start_number: Number(e.target.value) })} />
          </label>
          <button onClick={saveSettings} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088C7] text-white font-semibold text-sm">
            <Save size={16} /> Save
          </button>
        </div>
        <p className="text-sm text-slate-600">Next ID preview: <strong className="text-[#0088C7]">{preview || "—"}</strong></p>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-800">Issued certificates</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Credential ID</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {certs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No certificates issued yet.</td></tr>
              )}
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.student_name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600">{c.course_title}</td>
                  <td className="px-4 py-3 font-mono text-[#0088C7]">{c.certificate_id}</td>
                  <td className="px-4 py-3 text-slate-600">{c.issued_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-800">
          Course assessments {selectedCourseId ? `(course #${selectedCourseId})` : ""}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {!selectedCourseId && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Select a course to review assessments.</td></tr>
              )}
              {selectedCourseId && assessments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No assessments yet.</td></tr>
              )}
              {assessments.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{a.student_name}</td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="px-4 py-3">
                    {a.file_name ? (
                      <button onClick={() => downloadFile(a.file_name)} className="inline-flex items-center gap-1 text-[#0088C7] font-semibold">
                        <Download size={14} /> {a.file_name}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.link ? (
                      <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0088C7]">
                        <ExternalLink size={14} /> Open
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">{a.submitted_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CertificateDesk;
