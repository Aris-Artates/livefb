import { useEffect, useRef, useState } from "react";
import { qnaApi } from "../utils/api";
import { type User } from "../utils/auth";

interface QnASessionProps {
  classId: string;
  user: User | null;
  isAdmin: boolean;
}

export default function QnASession({ classId, user, isAdmin }: QnASessionProps) {
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; msg: string } | null>(
    null
  );
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchSession = async () => {
    try {
      const res = await qnaApi.getActiveSession(classId);
      setSession(res.data.active ? res.data.session : null);
    } catch {
      // Silently ignore
    }
  };

  useEffect(() => {
    fetchSession();
    intervalRef.current = setInterval(fetchSession, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [classId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !session) return;
    setSubmitting(true);
    setFlash(null);
    try {
      await qnaApi.submitQuestion(session.id, question.trim(), isAnonymous);
      setQuestion("");
      setFlash({ type: "success", msg: "Question submitted!" });
      await fetchSession(); // Refresh questions list
    } catch (err: any) {
      setFlash({
        type: "error",
        msg: err.response?.data?.detail || "Failed to submit question.",
      });
    } finally {
      setSubmitting(false);
      setTimeout(() => setFlash(null), 3000);
    }
  };

  if (!session) return null;

  const questions: any[] = session.qna_questions ?? [];

  return (
    <div className="mt-4 bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">
          Q&amp;A: {session.title}
        </h3>
        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
          Active
        </span>
      </div>

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
          {questions.map((q: any) => (
            <div
              key={q.id}
              className={`rounded-lg p-3 ${
                q.is_answered ? "bg-green-900/30" : "bg-gray-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-gray-400 text-xs">
                    {q.is_anonymous
                      ? "Anonymous"
                      : q.users?.full_name || "Student"}
                  </span>
                  <p className="text-white text-sm break-words">
                    {q.question_text}
                  </p>
                  {q.is_answered && q.answer_text && (
                    <p className="text-green-400 text-sm mt-1">
                      A: {q.answer_text}
                    </p>
                  )}
                </div>
                {q.is_answered && (
                  <span className="text-green-400 text-xs whitespace-nowrap flex-shrink-0">
                    ✓ Answered
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flash message */}
      {flash && (
        <p
          className={`text-xs mb-2 ${
            flash.type === "success" ? "text-green-400" : "text-red-400"
          }`}
        >
          {flash.msg}
        </p>
      )}

      {/* Submit form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question…"
          maxLength={500}
          rows={2}
          className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 resize-none placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded"
            />
            Ask anonymously
          </label>
          <button
            type="submit"
            disabled={submitting || !question.trim()}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
