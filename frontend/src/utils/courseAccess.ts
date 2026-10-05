import axios from "axios";
import API_BASE_URL from "../config";

/**
 * Resolve where a logged-in student should go for a shared course id.
 * Enrolled → course modules (player). Otherwise → learning/explore with that course highlighted.
 */
export async function resolveStudentCoursePath(
  courseId: string | number,
  token: string
): Promise<string> {
  const id = String(courseId);
  try {
    await axios.get(`${API_BASE_URL}/courses/${id}/player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Open modules / lessons for this course
    return `/course/${id}/player`;
  } catch (err: any) {
    const status = err?.response?.status;
    // Not enrolled / trial expired → courses page so they can unlock & learn
    if (status === 402 || status === 403 || status === 404) {
      return `/student-dashboard?course=${id}&tab=explore`;
    }
    return `/student-dashboard?course=${id}&tab=learning`;
  }
}
