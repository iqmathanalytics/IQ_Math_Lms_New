import axios from "axios";
import API_BASE_URL from "../config";

/**
 * Resolve where a logged-in student should go for a shared course id.
 * Uses lightweight /access (not the full player payload) so redirects stay fast.
 */
export async function resolveStudentCoursePath(
  courseId: string | number,
  token: string
): Promise<string> {
  const id = String(courseId);
  try {
    const res = await axios.get(`${API_BASE_URL}/courses/${id}/access`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    if (res.data?.can_play) {
      return `/course/${id}/player`;
    }
    return `/student-dashboard?course=${id}&tab=explore`;
  } catch {
    // On network/timeout, open player — CoursePlayer will bounce if needed
    return `/course/${id}/player`;
  }
}

/** Instant path when we already know the student should open modules. */
export function studentPlayerPath(courseId: string | number): string {
  return `/course/${String(courseId)}/player`;
}
