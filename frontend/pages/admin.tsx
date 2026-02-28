import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { livestreamApi, quizApi, qnaApi } from "../utils/api";
import { type User } from "../utils/auth";
import Navbar from "../components/Navbar";

export default function AdminPage({ user }: { user: User | null }) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [livestreams, setLivestreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create livestream form
  const [form, setForm] = useState({
    class_id: "",
    title: "",
    facebook_video_id: "",
    facebook_group_id: "",
    scheduled_at: "",
    is_private: true,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Guards ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "admin") { router.replace("/dashboard"); return; }
    fetchStreams();
  }, [user]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchStreams = () => {
    setLoading(true);
    livestreamApi
      .list()
      .then((res) => setLivestreams(res.data))
      .catch(() => setError("Failed to load livestreams"))
      .finally(() => setLoading(false));
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id.trim() || !form.title.trim()) {
      setCreateError("Class ID and Title are required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const payload: any = {
        class_id: form.class_id.trim(),
        title: form.title.trim(),
        is_private: form.is_private,
      };
      if (form.facebook_video_id.trim())
        payload.facebook_video_id = form.facebook_video_id.trim();
      if (form.facebook_group_id.trim())
        payload.facebook_group_id = form.facebook_group_id.trim();
      if (form.scheduled_at)
        payload.scheduled_at = new Date(form.scheduled_at).toISOString();

      await livestreamApi.create(payload);
      setForm({
        class_id: "",
        title: "",
        facebook_video_id: "",
        facebook_group_id: "",
        scheduled_at: "",
        is_private: true,
      });
      fetchStreams();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Failed to create livestream.");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await livestreamApi.activate(id);
      fetchStreams();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to activate.");
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await livestreamApi.deactivate(id);
      fetchStreams();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to deactivate.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage live classes, quizzes, and Q&amp;A sessions.
          </p>
        </div>

        {/* ── Create Livestream ───────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Create Livestream
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            Start your Facebook Live first, then paste the video ID from the
            URL (e.g.&nbsp;
            <span className="font-mono bg-gray-100 px-1 rounded">
              facebook.com/video/&lt;VIDEO_ID&gt;
            </span>
            ).
          </p>

          {createError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                placeholder="UUID of the class"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Math Live Session #1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Video ID
              </label>
              <input
                type="text"
                value={form.facebook_video_id}
                onChange={(e) =>
                  setForm({ ...form, facebook_video_id: e.target.value })
                }
                placeholder="Numeric ID from the Facebook URL"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Group ID
                <span className="text-gray-400 font-normal"> (if private group)</span>
              </label>
              <input
                type="text"
                value={form.facebook_group_id}
                onChange={(e) =>
                  setForm({ ...form, facebook_group_id: e.target.value })
                }
                placeholder="Leave blank for public page videos"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled At
                <span className="text-gray-400 font-normal"> (optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) =>
                  setForm({ ...form, scheduled_at: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="is_private"
                checked={form.is_private}
                onChange={(e) =>
                  setForm({ ...form, is_private: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="is_private" className="text-sm text-gray-700">
                Private (enrolled students only)
              </label>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating…" : "Create Livestream"}
              </button>
            </div>
          </form>
        </section>

        {/* ── Livestream List ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            All Livestreams
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : livestreams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No livestreams yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {livestreams.map((stream) => (
                <div
                  key={stream.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {stream.is_active && (
                        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          LIVE
                        </span>
                      )}
                      <span className="font-semibold text-gray-900 truncate">
                        {stream.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Class: {stream.class_id}
                    </p>
                    {stream.facebook_video_id && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        FB Video ID: {stream.facebook_video_id}
                      </p>
                    )}
                    {stream.scheduled_at && !stream.is_active && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Scheduled:{" "}
                        {new Date(stream.scheduled_at).toLocaleString()}
                      </p>
                    )}
                    {stream.started_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Started:{" "}
                        {new Date(stream.started_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <button
                      onClick={() => router.push(`/livestream/${stream.id}`)}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      View Page
                    </button>

                    {stream.is_active ? (
                      <button
                        onClick={() => handleDeactivate(stream.id)}
                        className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors font-medium"
                      >
                        End Stream
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(stream.id)}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors font-medium"
                      >
                        Go Live
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section className="bg-blue-50 rounded-xl border border-blue-100 p-6">
          <h2 className="text-base font-semibold text-blue-900 mb-3">
            How the Live Flow Works
          </h2>
          <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
            <li>
              Start your live video on Facebook (from your phone or Creator
              Studio).
            </li>
            <li>
              Copy the video ID from the Facebook URL — it&apos;s the long
              number in the address bar.
            </li>
            <li>
              Create a livestream record above with that video ID and your
              class.
            </li>
            <li>
              Click <strong>Go Live</strong> — this marks the stream as active
              so students can join.
            </li>
            <li>
              Students see it on their dashboard with a <em>Join Live</em>{" "}
              button. The page shows the embedded Facebook video + live
              comments, Q&amp;A, and quizzes.
            </li>
            <li>
              When done, click <strong>End Stream</strong> to mark it
              inactive.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
