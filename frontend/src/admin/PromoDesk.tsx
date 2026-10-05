import { useEffect, useState } from "react";
import axios from "axios";
import { Percent, Plus, Trash2, RefreshCw } from "lucide-react";
import API_BASE_URL from "../config";
import { authHeaders } from "../utils/session";

type Promo = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  course_id: number | null;
  course_title?: string | null;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  valid_until: string | null;
  note: string;
  created_at: string;
};

type CourseOpt = { id: number; title: string };

const emptyForm = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: 10,
  course_id: "" as number | "",
  max_uses: 0,
  is_active: true,
  valid_until: "",
  note: "",
};

const PromoDesk = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      // Independent loads so promo list and course dropdown stay in sync with My Courses
      const [pRes, cRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/admin/promo-codes`, { headers: authHeaders() }),
        axios.get(`${API_BASE_URL}/admin/course-options`, { headers: authHeaders() }),
      ]);

      if (pRes.status === "fulfilled") {
        setPromos(pRes.value.data || []);
      } else {
        setToast("Failed to load promo codes");
      }

      if (cRes.status === "fulfilled") {
        const rows = (cRes.value.data || [])
          .map((c: any) => ({ id: Number(c.id ?? c.course_id), title: String(c.title || `Course #${c.id}`) }))
          .filter((c: CourseOpt) => Number.isFinite(c.id));
        setCourses(rows);
        if (!rows.length) {
          setToast((prev) => prev || "No courses found. Create a course under My Courses first.");
        }
      } else {
        // Fallback to /courses (same source as My Courses)
        try {
          const fallback = await axios.get(`${API_BASE_URL}/courses`, { headers: authHeaders() });
          setCourses(
            (fallback.data || []).map((c: any) => ({
              id: Number(c.id),
              title: String(c.title || `Course #${c.id}`),
            }))
          );
        } catch {
          setToast("Failed to load courses for promo targeting");
        }
      }
    } catch {
      setToast("Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const payload = () => ({
    code: form.code,
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value),
    course_id: form.course_id === "" ? null : Number(form.course_id),
    max_uses: Number(form.max_uses) || 0,
    is_active: form.is_active,
    valid_until: form.valid_until || null,
    note: form.note,
  });

  const submit = async () => {
    try {
      if (editingId) {
        await axios.patch(`${API_BASE_URL}/admin/promo-codes/${editingId}`, payload(), { headers: authHeaders() });
        setToast("Promo updated");
      } else {
        await axios.post(`${API_BASE_URL}/admin/promo-codes`, payload(), { headers: authHeaders() });
        setToast("Promo created");
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err: any) {
      setToast(err?.response?.data?.detail || "Save failed");
    }
  };

  const startEdit = (p: Promo) => {
    setEditingId(p.id);
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      course_id: p.course_id ?? "",
      max_uses: p.max_uses,
      is_active: p.is_active,
      valid_until: p.valid_until || "",
      note: p.note || "",
    });
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this promo and its redemptions?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/admin/promo-codes/${id}`, { headers: authHeaders() });
      setToast("Promo deleted");
      load();
    } catch {
      setToast("Delete failed");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading promo codes…</div>;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="text-[#0088C7]" /> Promo codes
          </h1>
          <p className="text-slate-500 text-sm">Create discount codes applied at Razorpay checkout.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {toast && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm shadow-sm">
          {toast}
          <button className="ml-3 text-slate-400" onClick={() => setToast("")}>×</button>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Plus size={18} /> {editingId ? "Edit promo" : "New promo"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <select className="border border-slate-200 rounded-lg px-3 py-2" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed (₹)</option>
          </select>
          <input type="number" className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
          <select className="border border-slate-200 rounded-lg px-3 py-2" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value === "" ? "" : Number(e.target.value) })}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <input type="number" className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Max uses (0=unlimited)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} />
          <input type="date" className="border border-slate-200 rounded-lg px-3 py-2" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          <input className="border border-slate-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="px-4 py-2 rounded-lg bg-[#0088C7] text-white font-semibold text-sm">
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No promo codes yet.</td></tr>
              )}
              {promos.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{p.code}</td>
                  <td className="px-4 py-3">{p.discount_type === "percent" ? `${p.discount_value}%` : `₹${p.discount_value}`}</td>
                  <td className="px-4 py-3">{p.course_title || "All courses"}</td>
                  <td className="px-4 py-3">{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
                  <td className="px-4 py-3">{p.valid_until || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => startEdit(p)} className="text-[#0088C7] font-semibold">Edit</button>
                    <button onClick={() => remove(p.id)} className="text-red-500 inline-flex items-center gap-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PromoDesk;
