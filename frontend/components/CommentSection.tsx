import { useEffect, useRef, useState } from "react";
import { commentApi } from "../utils/api";
import { type User } from "../utils/auth";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  student_id: string;
  users?: { full_name: string; avatar_url?: string };
}

interface CommentSectionProps {
  livestreamId: string;
  user: User | null;
}

export default function CommentSection({
  livestreamId,
  user,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchComments = async () => {
    try {
      const res = await commentApi.getForLivestream(livestreamId);
      setComments(res.data);
    } catch {
      // Silently ignore poll failures
    }
  };

  useEffect(() => {
    fetchComments();
    // Poll every 5 seconds for new comments
    intervalRef.current = setInterval(fetchComments, 5000);
    return () => clearInterval(intervalRef.current);
  }, [livestreamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosting(true);
    setError("");
    try {
      const res = await commentApi.post(livestreamId, draft.trim());
      setComments((prev) => [...prev, res.data]);
      setDraft("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const initial = (name?: string) => name?.[0]?.toUpperCase() || "?";

  return (
    <div className="bg-gray-800 rounded-xl flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Live Comments</h3>
        <span className="text-gray-500 text-xs">{comments.length}</span>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-8">
            No comments yet. Be the first!
          </p>
        )}
        {comments.map((c) => {
          const isOwn = c.student_id === user?.id;
          const name = isOwn ? "You" : c.users?.full_name || "Student";
          return (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs flex-shrink-0 font-medium">
                {initial(c.users?.full_name)}
              </div>
              <div className="min-w-0">
                <span className={`text-xs font-semibold ${isOwn ? "text-blue-400" : "text-gray-300"}`}>
                  {name}
                </span>
                <p className="text-gray-200 text-sm break-words">{c.content}</p>
                <span className="text-gray-600 text-xs">{formatTime(c.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700">
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 min-w-0 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={posting || !draft.trim()}
            className="bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
