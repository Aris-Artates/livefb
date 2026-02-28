import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { authApi } from "../utils/api";
import { saveTokens, isTokenValid } from "../utils/auth";
import { initFacebookLogin, facebookLogin } from "../utils/facebook";

export default function RegisterPage({ setUser }: { setUser: (u: any) => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);

  useEffect(() => {
    if (isTokenValid()) {
      router.replace("/dashboard");
      return;
    }
    initFacebookLogin().catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register(form);
      const { access_token, refresh_token, user } = res.data;
      saveTokens(access_token, refresh_token);
      setUser(user);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookRegister = async () => {
    setError("");
    setFbLoading(true);
    try {
      const fbToken = await facebookLogin();
      if (!fbToken) {
        setError("Facebook sign-up cancelled or denied.");
        return;
      }
      const res = await authApi.facebookCallback(fbToken);
      const { access_token, refresh_token, user } = res.data;
      saveTokens(access_token, refresh_token);
      setUser(user);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Facebook sign-up failed.");
    } finally {
      setFbLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
          Create Account
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Fill in the form below or sign up with Facebook
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Email / password form — shown first */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Facebook sign-up — below the form */}
        <div className="flex items-center my-5">
          <hr className="flex-1 border-gray-200" />
          <span className="px-3 text-xs text-gray-400">or continue with</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleFacebookRegister}
          disabled={fbLoading}
          className="w-full bg-[#1877F2] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1565e0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.532-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          {fbLoading ? "Connecting…" : "Continue with Facebook"}
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
