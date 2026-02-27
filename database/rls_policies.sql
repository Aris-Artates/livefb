-- ============================================================
-- Row-Level Security (RLS) Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Enable RLS on every table
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestreams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qna_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qna_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- ─── Helper functions (SECURITY DEFINER runs as DB owner, not calling user) ───

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION is_enrolled_in_class(p_class_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM enrollments
        WHERE student_id = auth.uid() AND class_id = p_class_id
    );
$$;

-- ─── USERS ───────────────────────────────────────────────────────────────────

-- Users can read their own row; admins can read all
CREATE POLICY "users: read own or admin"
    ON users FOR SELECT
    USING (id = auth.uid() OR is_admin());

-- Users can update their own row but cannot change their role
CREATE POLICY "users: update own (no role escalation)"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT role FROM users WHERE id = auth.uid())
    );

-- Inserts are done by the FastAPI backend using the service_role key (bypasses RLS).
-- Deny direct inserts from the anon/authenticated role.
CREATE POLICY "users: no direct insert"
    ON users FOR INSERT
    WITH CHECK (FALSE);

-- ─── CLASSES ─────────────────────────────────────────────────────────────────

CREATE POLICY "classes: read if enrolled or admin"
    ON classes FOR SELECT
    USING (
        is_admin()
        OR is_enrolled_in_class(id)
    );

CREATE POLICY "classes: write admin only"
    ON classes FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "classes: update admin only"
    ON classes FOR UPDATE USING (is_admin());

-- ─── ENROLLMENTS ─────────────────────────────────────────────────────────────

CREATE POLICY "enrollments: read own or admin"
    ON enrollments FOR SELECT
    USING (student_id = auth.uid() OR is_admin());

CREATE POLICY "enrollments: write admin only"
    ON enrollments FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "enrollments: delete admin only"
    ON enrollments FOR DELETE USING (is_admin());

-- ─── LIVESTREAMS ─────────────────────────────────────────────────────────────

CREATE POLICY "livestreams: read if enrolled or admin"
    ON livestreams FOR SELECT
    USING (
        is_admin()
        OR is_enrolled_in_class(class_id)
    );

CREATE POLICY "livestreams: write admin only"
    ON livestreams FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "livestreams: update admin only"
    ON livestreams FOR UPDATE USING (is_admin());

-- ─── COMMENTS ────────────────────────────────────────────────────────────────

-- Students can read comments only for livestreams in their enrolled classes
CREATE POLICY "comments: read if enrolled or admin"
    ON comments FOR SELECT
    USING (
        is_admin()
        OR EXISTS (
            SELECT 1
            FROM livestreams ls
            JOIN enrollments e ON e.class_id = ls.class_id
            WHERE ls.id = comments.livestream_id
              AND e.student_id = auth.uid()
        )
    );

-- Students can only post their own comments to active livestreams in their classes
CREATE POLICY "comments: insert own for active stream"
    ON comments FOR INSERT
    WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM livestreams ls
            JOIN enrollments e ON e.class_id = ls.class_id
            WHERE ls.id = comments.livestream_id
              AND ls.is_active = TRUE
              AND e.student_id = auth.uid()
        )
    );

-- Soft-delete by admin only (no student deletes)
CREATE POLICY "comments: update (soft-delete) admin only"
    ON comments FOR UPDATE USING (is_admin());

-- ─── QUIZZES ─────────────────────────────────────────────────────────────────

CREATE POLICY "quizzes: read if enrolled or admin"
    ON quizzes FOR SELECT
    USING (
        is_admin()
        OR is_enrolled_in_class(class_id)
    );

CREATE POLICY "quizzes: write admin only"
    ON quizzes FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "quizzes: update admin only"
    ON quizzes FOR UPDATE USING (is_admin());

-- ─── QUIZ QUESTIONS ──────────────────────────────────────────────────────────

-- Students can read questions (correct_answer is stripped in the API layer)
CREATE POLICY "quiz_questions: read if enrolled or admin"
    ON quiz_questions FOR SELECT
    USING (
        is_admin()
        OR EXISTS (
            SELECT 1 FROM quizzes q
            WHERE q.id = quiz_questions.quiz_id
              AND is_enrolled_in_class(q.class_id)
        )
    );

CREATE POLICY "quiz_questions: write admin only"
    ON quiz_questions FOR INSERT WITH CHECK (is_admin());

-- ─── QUIZ ANSWERS ────────────────────────────────────────────────────────────

-- KEY PRIVACY RULE: students can ONLY see their own answers
CREATE POLICY "quiz_answers: read own or admin"
    ON quiz_answers FOR SELECT
    USING (student_id = auth.uid() OR is_admin());

-- Students can only submit their own answers
CREATE POLICY "quiz_answers: insert own"
    ON quiz_answers FOR INSERT
    WITH CHECK (student_id = auth.uid());

-- Answers are immutable after submission (no UPDATE policy)

-- ─── Q&A SESSIONS ────────────────────────────────────────────────────────────

CREATE POLICY "qna_sessions: read if enrolled or admin"
    ON qna_sessions FOR SELECT
    USING (
        is_admin()
        OR is_enrolled_in_class(class_id)
    );

CREATE POLICY "qna_sessions: write admin only"
    ON qna_sessions FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "qna_sessions: update admin only"
    ON qna_sessions FOR UPDATE USING (is_admin());

-- ─── Q&A QUESTIONS ───────────────────────────────────────────────────────────

-- Students can see all questions (but anonymous ones have student_id masked in API)
CREATE POLICY "qna_questions: read if enrolled or admin"
    ON qna_questions FOR SELECT
    USING (
        is_admin()
        OR EXISTS (
            SELECT 1 FROM qna_sessions s
            WHERE s.id = qna_questions.session_id
              AND is_enrolled_in_class(s.class_id)
        )
    );

CREATE POLICY "qna_questions: insert own"
    ON qna_questions FOR INSERT
    WITH CHECK (student_id = auth.uid() OR is_admin());

-- Only admins can mark questions answered
CREATE POLICY "qna_questions: update admin only"
    ON qna_questions FOR UPDATE USING (is_admin());

-- ─── AI RECOMMENDATIONS ──────────────────────────────────────────────────────

-- Students can only read their own recommendations
CREATE POLICY "ai_recommendations: read own or admin"
    ON ai_recommendations FOR SELECT
    USING (student_id = auth.uid() OR is_admin());

-- Backend (service_role) bypasses RLS for upsert; deny direct access
CREATE POLICY "ai_recommendations: no direct write"
    ON ai_recommendations FOR INSERT
    WITH CHECK (FALSE);
