import Cookies from "js-cookie";
import { authApi } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "student";
  facebook_id?: string;
  avatar_url?: string;
}

const COOKIE_OPTS: Cookies.CookieAttributes = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  expires: 1, // 1 day
};

const REFRESH_OPTS: Cookies.CookieAttributes = {
  ...COOKIE_OPTS,
  expires: 7,
};

export function saveTokens(accessToken: string, refreshToken: string) {
  Cookies.set("access_token", accessToken, COOKIE_OPTS);
  Cookies.set("refresh_token", refreshToken, REFRESH_OPTS);
}

export function clearTokens() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
}

export function getAccessToken(): string | undefined {
  return Cookies.get("access_token");
}

export function isTokenValid(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isTokenValid()) return null;
  try {
    const res = await authApi.me();
    return res.data as User;
  } catch {
    return null;
  }
}

export function logout() {
  clearTokens();
  window.location.href = "/login";
}
