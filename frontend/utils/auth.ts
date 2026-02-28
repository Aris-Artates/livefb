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
  expires: 1,   // access token cookie: 1 day (JWT itself expires in 60 min)
};

const REFRESH_OPTS: Cookies.CookieAttributes = {
  ...COOKIE_OPTS,
  expires: 30,  // refresh token cookie: 30 days (JWT expires per REFRESH_TOKEN_EXPIRE_DAYS)
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

/**
 * Load the current user on app startup.
 *
 * Priority:
 *  1. Valid access token   → call /me directly.
 *  2. Expired/missing access token + stored refresh token → silent refresh,
 *     then call /me (so users stay logged in across browser restarts).
 *  3. No tokens at all     → return null (show login page).
 */
export async function getCurrentUser(): Promise<User | null> {
  // ── Fast path: access token is still valid ───────────────────────────────
  if (isTokenValid()) {
    try {
      const res = await authApi.me();
      return res.data as User;
    } catch {
      return null;
    }
  }

  // ── Slow path: try a silent refresh before giving up ────────────────────
  const storedRefresh = Cookies.get("refresh_token");
  if (!storedRefresh) return null; // nothing to try

  try {
    const res = await authApi.refresh(storedRefresh);
    const { access_token, refresh_token: newRefresh } = res.data;
    saveTokens(access_token, newRefresh); // extend cookie lifetime
    const userRes = await authApi.me();
    return userRes.data as User;
  } catch {
    // Refresh token expired/invalid — clear everything and show login
    clearTokens();
    return null;
  }
}

export function logout() {
  clearTokens();
  window.location.href = "/login";
}
