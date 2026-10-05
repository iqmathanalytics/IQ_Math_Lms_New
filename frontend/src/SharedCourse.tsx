import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { BookOpen, Lock, LogIn, PlayCircle } from "lucide-react";
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
  }[];
};

const SharedCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const session = getValidSession();
  const studentToken = session && isStudent(session.role) ? session.token : null;

  // Logged-in students: open course modules (player) or courses list
  useEffect(() => {
    if (!studentToken || !courseId) return;

    let cancelled = false;
    (async () => {
      setRedirecting(true);
      try {
        const dest = await resolveStudentCoursePath(courseId, studentToken);
        if (!cancelled) navigate(dest, { replace: true });
      } catch {
        if (!cancelled) navigate(`/student-dashboard?course=${courseId}&tab=learning`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, studentToken, navigate]);

  // Guests: load public teaser (login required to learn)
  useEffect(() => {
    if (studentToken) return;

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
  }, [courseId, studentToken]);

  const loginHref = `/login?course=${courseId || course?.id || ""}&next=course`;

  if (redirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-iqBlue/20 border-t-iqBlue" />
        <p className="text-sm font-semibold text-slate-600">Opening course modules…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading course…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <BookOpen className="text-slate-300" size={48} />
        <h1 className="text-xl font-bold text-slate-800">{error || "Course not found"}</h1>
        <Link to="/" className="font-semibold text-[#0088C7]">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo size="sm" />
          </Link>
          <Link
            to={loginHref}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0088C7] px-4 py-2 text-sm font-bold text-white"
          >
            <LogIn size={16} /> Login to learn
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Login required banner */}
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="font-bold text-amber-900">Login required</h2>
              <p className="mt-0.5 text-sm text-amber-800/90">
                Sign in with your student account to open this course and start learning modules.
              </p>
            </div>
          </div>
          <Link
            to={loginHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0088C7] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20"
          >
            <LogIn size={16} /> Login to access course
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex h-52 items-center justify-center bg-slate-50 sm:h-64">
            {course.image_url ? (
              <FastImage
                src={course.image_url}
                alt={course.title}
                widthHint={960}
                priority
                fit="contain"
                className="h-full w-full"
                skeletonClassName="h-52 w-full sm:h-64"
              />
            ) : (
              <BookOpen className="text-slate-300" size={48} />
            )}
          </div>
          <div className="space-y-2 p-6">
            <h1 className="text-2xl font-extrabold text-slate-900">{course.title}</h1>
            <p className="text-sm leading-relaxed text-slate-600">{course.description}</p>
            <div className="flex flex-wrap gap-3 pt-2 text-xs font-bold uppercase text-slate-500">
              <span>{course.module_count} modules</span>
              <span>{course.lesson_count} lessons</span>
              <span>{course.language}</span>
              <span className="text-[#0088C7]">₹{course.price}</span>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Curriculum overview</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
              <Lock size={12} /> Module titles only until you log in
            </span>
          </div>
          <div className="space-y-2">
            {course.modules.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Lock size={14} className="shrink-0 text-slate-400" />
                  <h3 className="truncate font-semibold text-slate-700">
                    {m.order}. {m.title}
                  </h3>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-400">
                  {m.lesson_count} lessons
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="pb-10 text-center">
          <Link
            to={loginHref}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0088C7] px-6 py-3.5 font-bold text-white shadow-lg shadow-blue-500/20"
          >
            <PlayCircle size={18} /> Login & open course modules
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            After login you’ll go to your courses and this course’s modules will open.
          </p>
        </div>
      </main>
    </div>
  );
};

export default SharedCourse;
