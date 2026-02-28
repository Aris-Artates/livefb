import axios from "axios";
import Cookies from "js-cookie";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Cookie options must match what auth.ts writes so we can update them here too
const COOKIE_OPTS: Cookies.CookieAttributes = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  expires: 1,   // access token: 1 day cookie lifetime
};
const REFRESH_OPTS: Cookies.CookieAttributes = {
  ...COOKIE_OPTS,
  expires: 30,  // refresh token: 30 days — keeps users logged in for a month
};

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // JWT in Authorization header, not cookies sent to backend
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auto-refresh on 401 ──────────────────────────────────────────────────────
// When the access token expires the backend returns 401.  We silently swap it
// for a new one using the refresh token so the user stays logged in.
//
// Deduplication: if multiple requests fail with 401 at the same time we only
// call /refresh once and queue the retries behind the same promise.

let _pendingRefresh: Promise<string> | null = null;

async function _doRefresh(): Promise<string> {
  const refreshToken = Cookies.get("refresh_token");
  if (!refreshToken) throw new Error("No refresh token stored");

  // Use a plain axios call (not `api`) to avoid triggering this interceptor again
  const res = await axios.post(`${API_BASE}/api/auth/refresh`, null, {
    params: { refresh_token: refreshToken },
  });

  const { access_token, refresh_token: newRefresh } = res.data;
  Cookies.set("access_token", access_token, COOKIE_OPTS);
  Cookies.set("refresh_token", newRefresh, REFRESH_OPTS);
  return access_token;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;

    // Don't retry refresh calls themselves, and only handle 401s
    if (
      err.response?.status !== 401 ||
      original._retry ||
      original.url?.includes("/api/auth/refresh")
    ) {
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      // Deduplicate: all concurrent 401s share one refresh call
      if (!_pendingRefresh) {
        _pendingRefresh = _doRefresh().finally(() => {
          _pendingRefresh = null;
        });
      }
      const newToken = await _pendingRefresh;

      // Retry the original request with the fresh token
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      // Refresh failed (expired or revoked) — send to login
      Cookies.remove("access_token");
      Cookies.remove("refresh_token");
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(err);
    }
  }
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}
interface LoginData {
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterData) => api.post("/api/auth/register", data),
  login: (data: LoginData) => api.post("/api/auth/login", data),
  // Use plain axios (not `api`) for refresh so the 401 interceptor isn't triggered
  refresh: (refreshToken: string) =>
    axios.post(`${API_BASE}/api/auth/refresh`, null, {
      params: { refresh_token: refreshToken },
    }),
  facebookCallback: (token: string) =>
    api.post("/api/auth/facebook/callback", null, {
      params: { facebook_access_token: token },
    }),
  bindFacebook: (token: string) =>
    api.post("/api/auth/bind-facebook", { facebook_access_token: token }),
  me: () => api.get("/api/auth/me"),
};

export const livestreamApi = {
  list: () => api.get("/api/livestreams/"),
  get: (id: string) => api.get(`/api/livestreams/${id}`),
  create: (data: {
    class_id: string;
    title: string;
    facebook_video_id?: string;
    facebook_group_id?: string;
    scheduled_at?: string;
    is_private?: boolean;
  }) => api.post("/api/livestreams/", data),
  activate: (id: string) => api.patch(`/api/livestreams/${id}/activate`),
  deactivate: (id: string) => api.patch(`/api/livestreams/${id}/deactivate`),
};

export const commentApi = {
  getForLivestream: (livestreamId: string) =>
    api.get(`/api/comments/${livestreamId}`),
  post: (livestreamId: string, content: string) =>
    api.post("/api/comments/", { livestream_id: livestreamId, content }),
};

export const quizApi = {
  getForClass: (classId: string) =>
    api.get(`/api/quizzes/class/${classId}`),
  get: (quizId: string) => api.get(`/api/quizzes/${quizId}`),
  create: (data: {
    class_id: string;
    title: string;
    subject?: string;
    time_limit_seconds?: number;
    is_live?: boolean;
  }) => api.post("/api/quizzes/", data),
  addQuestion: (data: {
    quiz_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c?: string;
    option_d?: string;
    correct_answer: string;
    points?: number;
    order_index?: number;
  }) => api.post("/api/quizzes/questions", data),
  trigger: (quizId: string, classId: string) =>
    api.post("/api/quizzes/trigger", { quiz_id: quizId, class_id: classId }),
  close: (quizId: string) => api.post(`/api/quizzes/${quizId}/close`),
  submitAnswer: (
    quizId: string,
    questionId: string,
    selectedOption: string
  ) =>
    api.post(`/api/quizzes/${quizId}/answers`, {
      quiz_id: quizId,
      question_id: questionId,
      selected_option: selectedOption,
    }),
  getMyResults: (quizId: string) =>
    api.get(`/api/quizzes/${quizId}/my-results`),
  getAllResults: (quizId: string) =>
    api.get(`/api/quizzes/${quizId}/results`),
};

export const qnaApi = {
  getActiveSession: (classId: string) =>
    api.get(`/api/qna/sessions/active/${classId}`),
  createSession: (classId: string, title: string) =>
    api.post("/api/qna/sessions", { class_id: classId, title }),
  closeSession: (sessionId: string) =>
    api.patch(`/api/qna/sessions/${sessionId}/close`),
  submitQuestion: (
    sessionId: string,
    questionText: string,
    isAnonymous: boolean
  ) =>
    api.post("/api/qna/questions", {
      session_id: sessionId,
      question_text: questionText,
      is_anonymous: isAnonymous,
    }),
  answerQuestion: (questionId: string, answerText: string) =>
    api.patch(`/api/qna/questions/${questionId}/answer`, {
      answer_text: answerText,
    }),
};

export const classesApi = {
  list: () => api.get("/api/classes/"),
};

export const aiApi = {
  getRecommendations: (studentId: string) =>
    api.get(`/api/ai/recommendations/${studentId}`),
};
