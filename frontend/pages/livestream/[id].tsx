import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { livestreamApi } from "../../utils/api";
import { type User } from "../../utils/auth";
import Navbar from "../../components/Navbar";
import LivestreamEmbed from "../../components/LivestreamEmbed";
import CommentSection from "../../components/CommentSection";
import QuizModal from "../../components/QuizModal";
import QnASession from "../../components/QnASession";

export default function LivestreamPage({ user }: { user: User | null }) {
  const router = useRouter();
  const { id } = router.query;

  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    livestreamApi
      .get(id as string)
      .then((res) => setStream(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError("You are not enrolled in this class.");
        } else if (err.response?.status === 404) {
          setError("Livestream not found.");
        } else {
          setError("Failed to load livestream.");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            {error}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 text-blue-600 text-sm hover:underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar user={user} dark />

      <div className="max-w-screen-xl mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Main column ── */}
          <div className="flex-1 min-w-0">
            <LivestreamEmbed
              facebookVideoId={stream.facebook_video_id}
              facebookGroupId={stream.facebook_group_id}
              title={stream.title}
            />

            <div className="mt-4">
              <div className="flex items-center gap-3">
                {stream.is_active && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    LIVE
                  </span>
                )}
                <h1 className="text-white text-xl font-bold">{stream.title}</h1>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                {stream.classes?.title}
                {stream.classes?.subject ? ` · ${stream.classes.subject}` : ""}
              </p>
            </div>

            {/* Admin quiz trigger (placeholder – connect to your admin panel) */}
            {user?.role === "admin" && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-gray-400 text-xs mb-2">Admin controls</p>
                <p className="text-gray-500 text-xs">
                  Use the Admin panel to trigger quizzes and manage Q&amp;A sessions.
                </p>
              </div>
            )}

            {/* Q&A */}
            {stream.class_id && (
              <QnASession
                classId={stream.class_id}
                user={user}
                isAdmin={user?.role === "admin"}
              />
            )}
          </div>

          {/* ── Sidebar: comments ── */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <CommentSection livestreamId={stream.id} user={user} />
          </div>
        </div>
      </div>

      {/* Quiz overlay */}
      {activeQuizId && (
        <QuizModal
          quizId={activeQuizId}
          user={user}
          onClose={() => setActiveQuizId(null)}
        />
      )}
    </div>
  );
}
