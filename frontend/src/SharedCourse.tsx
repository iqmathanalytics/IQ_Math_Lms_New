import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { BookOpen, ChevronDown, ChevronRight, Lock, LogIn } from "lucide-react";
import API_BASE_URL from "./config";
import FastImage from "./components/FastImage";
import BrandLogo from "./components/BrandLogo";
import { getValidSession, isStudent } from "./utils/session";
import { resolveStudentCoursePath } from "./utils/courseAccess";

type PublicCourse = {
  id: number;
  title: string;
  description: string;
  price: number;
  image_url: string;
  language: string;
  course_type: string;
  module_count: number;
  lesson_count: number;
  preview: boolean;
  modules: {
    id: number;
    title: string;
    order: number;
    lesson_count: number;
    lessons: { id: number; title: string; type: string; order: number }[];
  }[];
};

const SharedCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);

  // Logged-in students skip the teaser and go to their course / dashboard
  useEffect(() => {
    const session = getValidSession();
    if (!session || !courseId) return;
    if (!isStudent(session.role)) return;

    let cancelled = false;
    (async () => {
      setRedirecting(true);
      const dest = await resolveStudentCoursePath(courseId, session.token);
      if (!cancelled) navigate(dest, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, navigate]);

  useEffect(() => {
    const session = getValidSession();
    // Don't bother loading teaser if student is being redirected
    if (isStudent(session?.role)) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE_URL}/public/courses/${courseId}`);
        setCourse(res.data);
      } catch (err: any) {
        setError(
          err?.response?.status === 404
            ? "This course is not available or unpublished."
            : "Failed to load course."
        );
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId]);

  const toggleModule = (id: number) => {
    setExpandedModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const loginHref = course
    ? `/login?course=${course.id}&next=course`
    : `/login?course=${courseId || ""}&next=course`;

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Opening your course…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading curriculum…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <BookOpen className="text-slate-300" size={48} />
        <h1 className="text-xl font-bold text-slate-800">{error || "Course not found"}</h1>
        <Link to="/" className="text-[#0088C7] font-semibold">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo size="sm" />
          </Link>
          <Link
            to={loginHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088C7] text-white text-sm font-bold"
          >
            <LogIn size={16} /> Sign in to access course
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {course.image_url ? (
            <FastImage
              src={course.image_url}
              alt=""
              widthHint={960}
              priority
              className="w-full h-48 object-cover"
              skeletonClassName="w-full h-48"
            />
          ) : (
            <div className="h-40 bg-slate-50 flex items-center justify-center">
              <BookOpen className="text-slate-300" size={48} />
            </div>
          )}
          <div className="p-6 space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900">{course.title}</h1>
            <p className="text-slate-600 text-sm leading-relaxed">{course.description}</p>
            <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500 uppercase pt-2">
              <span>{course.module_count} modules</span>
              <span>{course.lesson_count} lessons</span>
              <span>{course.language}</span>
              <span className="text-[#0088C7]">₹{course.price}</span>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-bold text-slate-800 text-lg">Curriculum</h2>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <Lock size={12} /> Module names only — sign in for topics
            </span>
          </div>
          <div className="space-y-2">
            {course.modules.map((m) => {
              const open = expandedModules.includes(m.id);
              return (
                <div key={m.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className="w-full flex justify-between items-center gap-2 p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {open ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                      <h3 className="font-semibold text-slate-800 truncate">
                        {m.order}. {m.title}
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-bold shrink-0">
                      {m.lesson_count} lessons
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-0 border-t border-slate-50 bg-slate-50/60">
                      <p className="text-sm font-semibold text-slate-800 mt-3">{m.title}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Lock size={12} /> Sign in to access topics and videos
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="text-center pb-10">
          <Link
            to={loginHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0088C7] text-white font-bold shadow-lg shadow-blue-500/20"
          >
            <LogIn size={18} /> Sign in to access course
          </Link>
        </div>
      </main>
    </div>
  );
};

export default SharedCourse;
