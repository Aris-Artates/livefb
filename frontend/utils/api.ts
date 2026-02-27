import axios from "axios";
import Cookies from "js-cookie";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// Redirect to /login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (typeof window !== "undefined" && err.response?.status === 401) {
      Cookies.remove("access_token");
      Cookies.remove("refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
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
};

export const qnaApi = {
  getActiveSession: (classId: string) =>
    api.get(`/api/qna/sessions/active/${classId}`),
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
};

export const aiApi = {
  getRecommendations: (studentId: string) =>
    api.get(`/api/ai/recommendations/${studentId}`),
};
