import { useEffect, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  getHomePath,
  getLoginPath,
  getValidSession,
  isInstructor,
  isStudent,
  ROLE_INSTRUCTOR,
  ROLE_STUDENT,
} from "../utils/session";
import { resolveStudentCoursePath } from "../utils/courseAccess";

/** Protects student/instructor pages; sends wrong role to their home; no session → correct login portal. */
export const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: any;
  requiredRole?: string;
}) => {
  const session = getValidSession();
  if (!session?.token) {
    return <Navigate to={getLoginPath(requiredRole)} replace />;
  }
  if (requiredRole && session.role !== requiredRole) {
    return <Navigate to={getHomePath(session.role)} replace />;
  }
  return children;
};

/**
 * Login portals: if already signed in, bounce to the right home.
 * Preserves share deep-link (?course=) for students.
 */
export const PublicOnlyRoute = ({ children }: { children: any }) => {
  const session = getValidSession();
  const [params] = useSearchParams();
  const location = useLocation();
  const courseId = params.get("course");

  if (!session?.token) return children;

  // Student already logged in + share deep-link → resolve course destination
  if (isStudent(session.role) && courseId && location.pathname === "/login") {
    return <StudentCourseBounce courseId={courseId} token={session.token} />;
  }

  // Student on admin-login (or instructor on student login) → own home
  if (isInstructor(session.role) && location.pathname === "/login") {
    return <Navigate to={getHomePath(ROLE_INSTRUCTOR)} replace />;
  }
  if (isStudent(session.role) && location.pathname === "/admin-login") {
    return <Navigate to={getHomePath(ROLE_STUDENT)} replace />;
  }

  return <Navigate to={getHomePath(session.role)} replace />;
};

/** Async bounce for already-authenticated students hitting /login?course= */
const StudentCourseBounce = ({ courseId, token }: { courseId: string; token: string }) => {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dest = await resolveStudentCoursePath(courseId, token);
      if (!cancelled) setTo(dest);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, token]);

  if (!to) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Opening your course…
      </div>
    );
  }
  return <Navigate to={to} replace />;
};

export const FallbackRoute = () => {
  const session = getValidSession();
  if (!session?.token) return <Navigate to="/" replace />;
  return <Navigate to={getHomePath(session.role)} replace />;
};
