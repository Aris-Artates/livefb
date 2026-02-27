-- ============================================================
-- LMS Database Schema for Supabase (PostgreSQL)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email            TEXT UNIQUE NOT NULL,
    hashed_password  TEXT,                   -- NULL for Facebook-only accounts
    full_name        TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'student'
                         CHECK (role IN ('admin', 'student')),
    facebook_id      TEXT UNIQUE,
    avatar_url       TEXT,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Classes ──────────────────────────────────────────────────────────────────
CREATE TABLE classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    description TEXT,
    subject     TEXT,
    created_by  UUID REFERENCES users(id),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Enrollments ──────────────────────────────────────────────────────────────
CREATE TABLE enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, class_id)
);

-- ─── Livestreams ──────────────────────────────────────────────────────────────
-- NOTE: Facebook private group video embedding requires the student to be
-- authenticated to Facebook with group access. Store the video/group IDs here
-- and construct the embed URL client-side via the Facebook JS SDK.
CREATE TABLE livestreams (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    facebook_video_id TEXT,    -- Facebook video or live-stream ID
    facebook_group_id TEXT,    -- Facebook group ID (for private group streams)
    stream_url        TEXT,    -- Fallback direct stream URL
    is_active         BOOLEAN DEFAULT FALSE,
    is_private        BOOLEAN DEFAULT TRUE,
    created_by        UUID REFERENCES users(id),
    scheduled_at      TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Comments ─────────────────────────────────────────────────────────────────
CREATE TABLE comments (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livestream_id  UUID NOT NULL REFERENCES livestreams(id) ON DELETE CASCADE,
    student_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    content        TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    is_deleted     BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Quizzes ──────────────────────────────────────────────────────────────────
CREATE TABLE quizzes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id            UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    subject             TEXT,
    is_active           BOOLEAN DEFAULT FALSE,
    is_live             BOOLEAN DEFAULT FALSE,   -- TRUE = triggered during a livestream
    triggered_at        TIMESTAMPTZ,
    time_limit_seconds  INTEGER DEFAULT 60,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Quiz Questions ───────────────────────────────────────────────────────────
CREATE TABLE quiz_questions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id        UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    option_a       TEXT NOT NULL,
    option_b       TEXT NOT NULL,
    option_c       TEXT,
    option_d       TEXT,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
    points         INTEGER DEFAULT 1,
    order_index    INTEGER DEFAULT 0
);

-- ─── Quiz Answers ─────────────────────────────────────────────────────────────
-- One row per student per question. Students CANNOT update after submission.
CREATE TABLE quiz_answers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id         UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selected_option TEXT NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, question_id)   -- one answer per student per question
);

-- ─── Q&A Sessions ─────────────────────────────────────────────────────────────
CREATE TABLE qna_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    created_by  UUID REFERENCES users(id),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    ended_at    TIMESTAMPTZ
);

-- ─── Q&A Questions ────────────────────────────────────────────────────────────
CREATE TABLE qna_questions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id    UUID NOT NULL REFERENCES qna_sessions(id) ON DELETE CASCADE,
    student_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 3 AND 500),
    is_anonymous  BOOLEAN DEFAULT FALSE,
    is_answered   BOOLEAN DEFAULT FALSE,
    answer_text   TEXT,
    answered_at   TIMESTAMPTZ,
    submitted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI Recommendations Cache ─────────────────────────────────────────────────
CREATE TABLE ai_recommendations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendations  JSONB,
    generated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id)
);

-- ─── Trigger: auto-update updated_at on users ─────────────────────────────────
CREATE OR REPLACE FUNCTION _update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION _update_updated_at();
