import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { livestreamApi, classesApi } from "../utils/api";
import { type User } from "../utils/auth";
import Navbar from "../components/Navbar";

// ─── Parse Facebook video/group ID out of any Facebook URL ───────────────────
function parseFacebookUrl(input: string): { videoId: string; groupId: string } {
  let videoId = "";
  let groupId = "";

  try {
    // Accept a bare numeric ID too (no URL needed)
    if (/^\d+$/.test(input.trim())) {
      return { videoId: input.trim(), groupId: "" };
    }

    const url = new URL(input.includes("://") ? input : `https://${input}`);

    // group ID from ?idorvanity= or path segment /groups/{id}/
    const idorvanity = url.searchParams.get("idorvanity");
    if (idorvanity) groupId = idorvanity;

    const groupMatch = url.pathname.match(/\/groups\/(\d+)/);
    if (groupMatch) groupId = groupMatch[1];

    // video ID from path: /videos/{id}, /permalink/{id}, or ?v=
    const vParam = url.searchParams.get("v");
    if (vParam) videoId = vParam;

    const pathMatch = url.pathname.match(/\/(?:videos|permalink)\/(\d+)/);
    if (pathMatch) videoId = pathMatch[1];
  } catch {
    // Not a valid URL — just return empty
  }

  return { videoId, groupId };
}

export default function AdminPage({ user }: { user: User | null }) {
  const router = useRouter();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [livestreams, setLivestreams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Create form ────────────────────────────────────────────────────────────
  const [fbUrl, setFbUrl] = useState("");
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
    Promise.allSettled([
      livestreamApi.list().then((r) => setLivestreams(r.data)),
      classesApi.list().then((r) => setClasses(r.data)),
    ]).finally(() => setLoading(false));
  }, [user]);

  // ── Auto-parse Facebook URL as user types ──────────────────────────────────
  const handleFbUrlChange = (value: string) => {
    setFbUrl(value);
    const { videoId, groupId } = parseFacebookUrl(value);
    setForm((f) => ({
      ...f,
      facebook_video_id: videoId || f.facebook_video_id,
      facebook_group_id: groupId || f.facebook_group_id,
    }));
  };

  // ── Refresh streams list ───────────────────────────────────────────────────
  const fetchStreams = () =>
    livestreamApi.list().then((r) => setLivestreams(r.data)).catch(() => {});

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setCreateError("Enter a title."); return; }
    if (!form.facebook_video_id.trim()) { setCreateError("Paste the Facebook Live URL or video ID."); return; }

    setCreating(true);
    setCreateError("");
    try {
      const payload: any = {
        title: form.title.trim(),
        facebook_video_id: form.facebook_video_id.trim(),
        is_private: form.is_private,
      };
      if (form.class_id) payload.class_id = form.class_id;
      if (form.facebook_group_id.trim()) payload.facebook_group_id = form.facebook_group_id.trim();
      if (form.scheduled_at) payload.scheduled_at = new Date(form.scheduled_at).toISOString();

      await livestreamApi.create(payload);
      setFbUrl("");
      setForm({ class_id: "", title: "", facebook_video_id: "", facebook_group_id: "", scheduled_at: "", is_private: true });
      fetchStreams();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Failed to create livestream.");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try { await livestreamApi.activate(id); fetchStreams(); }
    catch (err: any) { alert(err.response?.data?.detail || "Failed to activate."); }
  };

  const handleDeactivate = async (id: string) => {
    try { await livestreamApi.deactivate(id); fetchStreams(); }
    catch (err: any) { alert(err.response?.data?.detail || "Failed to deactivate."); }
  };

  if (!user || user.role !== "admin") return null;

  const parsed = parseFacebookUrl(fbUrl);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage live classes, quizzes, and Q&amp;A sessions.</p>
        </div>

        {/* ── Create Livestream ───────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Start a Live Class</h2>
          <p className="text-xs text-gray-500 mb-5">
            Go live on Facebook first, then paste the URL below.
          </p>

          {createError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Facebook URL — the key field, auto-parses everything */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Live URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fbUrl}
                onChange={(e) => handleFbUrlChange(e.target.value)}
                placeholder="Paste your Facebook Live URL here…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Show parsed IDs as confirmation */}
              {(parsed.videoId || parsed.groupId) && (
                <div className="mt-1.5 flex gap-4 text-xs text-gray-500 font-mono">
                  {parsed.videoId && <span>Video ID: <span className="text-green-600">{parsed.videoId}</span></span>}
                  {parsed.groupId && <span>Group ID: <span className="text-green-600">{parsed.groupId}</span></span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Class dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}{c.subject ? ` — ${c.subject}` : ""}
                    </option>
                  ))}
                </select>
                {classes.length === 0 && !loading && (
                  <p className="text-xs text-amber-600 mt-1">No classes found. Create one in Supabase first.</p>
                )}
              </div>

              {/* Title */}
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

              {/* Scheduled at (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled At <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Private toggle */}
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="is_private"
                  checked={form.is_private}
                  onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="is_private" className="text-sm text-gray-700">
                  Private (enrolled students only)
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating…" : "Create & Go Live"}
              </button>
            </div>
          </form>
        </section>

        {/* ── Livestream List ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Livestreams</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
          )}

          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : livestreams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No livestreams yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {livestreams.map((stream) => {
                const cls = classes.find((c) => c.id === stream.class_id);
                return (
                  <div
                    key={stream.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {stream.is_active && (
                          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                            LIVE
                          </span>
                        )}
                        <span className="font-semibold text-gray-900 truncate">{stream.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cls ? `${cls.title}${cls.subject ? ` — ${cls.subject}` : ""}` : stream.class_id}
                      </p>
                      {stream.facebook_video_id && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">
                          FB Video: {stream.facebook_video_id}
                        </p>
                      )}
                      {stream.scheduled_at && !stream.is_active && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Scheduled: {new Date(stream.scheduled_at).toLocaleString()}
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
                );
              })}
            </div>
          )}
        </section>

        {/* ── Webhook automation info ─────────────────────────────────────── */}
        <section className="bg-blue-50 rounded-xl border border-blue-100 p-6">
          <h2 className="text-base font-semibold text-blue-900 mb-2">
            Want full automation? Set up Facebook Webhooks
          </h2>
          <p className="text-sm text-blue-800 mb-3">
            When configured, starting a live on Facebook automatically creates and activates the stream here — no manual steps at all.
          </p>
          <ol className="space-y-1.5 text-sm text-blue-800 list-decimal list-inside">
            <li>Add these to your Railway environment variables:
              <code className="block mt-1 bg-blue-100 px-3 py-1.5 rounded text-xs font-mono">
                FACEBOOK_WEBHOOK_VERIFY_TOKEN=any_secret_string<br />
                FACEBOOK_DEFAULT_GROUP_ID=1847126809326672<br />
                FACEBOOK_DEFAULT_CLASS_ID=&lt;class UUID from Supabase&gt;
              </code>
            </li>
            <li>In your Facebook App Dashboard → Webhooks → Subscribe to <strong>group_feed</strong> → <strong>live_videos</strong> field</li>
            <li>Set Callback URL to: <code className="bg-blue-100 px-1 rounded text-xs font-mono">https://&lt;railway-domain&gt;/api/webhooks/facebook</code></li>
            <li>Set Verify Token to the same value as <code className="bg-blue-100 px-1 rounded text-xs font-mono">FACEBOOK_WEBHOOK_VERIFY_TOKEN</code></li>
            <li>Redeploy Railway — done. Go live on Facebook and it appears here automatically.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
