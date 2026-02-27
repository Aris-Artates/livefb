import { useEffect, useState } from "react";
import { quizApi } from "../utils/api";
import { type User } from "../utils/auth";

interface QuizModalProps {
  quizId: string;
  user: User | null;
  onClose: () => void;
}

export default function QuizModal({ quizId, user, onClose }: QuizModalProps) {
  const [quiz, setQuiz] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    quizApi
      .get(quizId)
      .then((res) => {
        setQuiz(res.data);
        setTimeLeft(res.data.time_limit_seconds ?? 60);
      })
      .catch(() => setError("Failed to load quiz."))
      .finally(() => setLoading(false));
  }, [quizId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || results) return;
    const t = setTimeout(() => setTimeLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, results]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timeLeft === 0 && !results) handleFinish();
  }, [timeLeft]);

  const handleAnswer = async (questionId: string, option: string) => {
    if (submitted[questionId]) return;
    setAnswers((p) => ({ ...p, [questionId]: option }));
    try {
      await quizApi.submitAnswer(quizId, questionId, option);
      setSubmitted((p) => ({ ...p, [questionId]: true }));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit answer.");
    }
  };

  const handleFinish = async () => {
    try {
      const res = await quizApi.getMyResults(quizId);
      setResults(res.data);
    } catch {
      setError("Failed to fetch results.");
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const questions: any[] = quiz?.quiz_questions ?? [];
  const question = questions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg text-gray-900">{quiz?.title}</h2>
          <div className="flex items-center gap-4">
            {timeLeft !== null && !results && (
              <span
                className={`font-mono text-sm font-bold ${
                  timeLeft < 10 ? "text-red-600" : "text-gray-600"
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {loading && <p className="text-gray-500 text-center">Loading quiz…</p>}

          {error && (
            <p className="text-red-600 text-sm mb-3">{error}</p>
          )}

          {/* Results screen */}
          {results && (
            <div className="text-center py-6">
              <p className="text-5xl font-bold text-blue-600 mb-2">
                {results.percentage}%
              </p>
              <p className="text-gray-600 mb-1">
                {results.score} / {results.total} correct
              </p>
              <p className="text-gray-400 text-sm mb-6">Quiz complete!</p>
              <button
                onClick={onClose}
                className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Question screen */}
          {!loading && !results && question && (
            <>
              {/* Progress */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  {submitted[question.id] && (
                    <span className="text-green-600 font-medium">Answered</span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <p className="font-semibold text-gray-900 mb-4">
                {question.question_text}
              </p>

              <div className="space-y-2">
                {(["a", "b", "c", "d"] as const).map((opt) => {
                  const text = question[`option_${opt}`];
                  if (!text) return null;
                  const isSelected = answers[question.id] === opt;
                  const isLocked = submitted[question.id];
                  return (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(question.id, opt)}
                      disabled={isLocked}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600"
                          : isLocked
                          ? "border-gray-200 text-gray-400 cursor-not-allowed"
                          : "border-gray-200 hover:bg-gray-50 text-gray-800"
                      }`}
                    >
                      <span className="font-semibold uppercase mr-2">{opt}.</span>
                      {text}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={() =>
                      setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Finish Quiz
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
