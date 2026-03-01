import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { livestreamApi, aiApi } from "../utils/api";
import { type User } from "../utils/auth";
import Navbar from "../components/Navbar";
import LivestreamEmbed from "../components/LivestreamEmbed";

export default function Dashboard({
  user,
}: {
  user: User | null;
}) {
  const router = useRouter();
  const [livestreams, setLivestreams] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchLivestreams = () =>
    livestreamApi.list().then((res) => setLivestreams(res.data)).catch(() => {});

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    Promise.allSettled([
      livestreamApi.list(),
      aiApi.getRecommendations(user.id),
    ]).then(([streamsResult, recsResult]) => {
      if (streamsResult.status === "fulfilled") {
        setLivestreams(streamsResult.value.data);
      }
      if (recsResult.status === "fulfilled") {
        setRecommendations(recsResult.value.data);
      }
    }).finally(() => setLoading(false));

    // Poll every 30 seconds to auto-detect new Facebook Live streams
    const interval = setInterval(fetchLivestreams, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  const liveStreams = livestreams.filter((s) => s.is_active);
  const upcomingStreams = livestreams.filter((s) => !s.is_active);
  const recs = recommendations?.recommendations?.recommendations || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.full_name}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Live Now — embedded player */}
        {liveStreams.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900">Live Now</h2>
            </div>

            {liveStreams.map((stream) => (
              <div
                key={stream.id}
                className="bg-black rounded-xl overflow-hidden shadow-lg mb-4"
              >
                {/* Facebook live player embedded directly */}
                <LivestreamEmbed
                  facebookVideoId={stream.facebook_video_id}
                  facebookGroupId={stream.facebook_group_id}
                  title={stream.title}
                />

                {/* Stream info bar */}
                <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      LIVE
                    </span>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {stream.title}
                      </p>
                      {stream.title && (
                        <p className="text-gray-400 text-xs">Facebook Live</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/livestream/${stream.id}`)}
                    className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    Full Screen →
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Upcoming */}
        {upcomingStreams.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upcoming Classes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                >
                  <p className="text-xs text-gray-500 mb-1">
                    {stream.classes?.subject}
                  </p>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {stream.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Facebook Live
                  </p>
                  {stream.scheduled_at && (
                    <p className="text-xs text-blue-600 mb-4">
                      {new Date(stream.scheduled_at).toLocaleString()}
                    </p>
                  )}
                  <button
                    onClick={() => router.push(`/livestream/${stream.id}`)}
                    className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {livestreams.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-8">
            <p className="text-gray-500">No classes scheduled yet.</p>
          </div>
        )}

        {/* AI Recommendations */}
        {recs.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                AI School Recommendations
              </h2>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                Powered by Ollama
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Based on your quiz performance ({recommendations.based_on_quizzes}{" "}
              quiz{recommendations.based_on_quizzes !== 1 ? "zes" : ""})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recs.map((rec: any, i: number) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                      {rec.school_name}
                    </h3>
                    <span className="text-green-600 text-xs font-semibold whitespace-nowrap ml-2">
                      {rec.likelihood_range}
                    </span>
                  </div>
                  <p className="text-blue-600 text-xs mb-2">{rec.program}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {rec.reasoning}
                  </p>
                </div>
              ))}
            </div>
            {recommendations?.recommendations?.general_advice && (
              <div className="mt-4 bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  {recommendations.recommendations.general_advice}
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
