-- MYRAA Course Studio learner tables — Supabase/Postgres DDL (Phase 6, for later migration)
-- SQLite stores datetimes as ISO-8601 TEXT; on Postgres use TIMESTAMPTZ.

CREATE TABLE IF NOT EXISTS cs_concepts (
    course_id TEXT NOT NULL REFERENCES cs_courses(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    lesson_id TEXT NOT NULL DEFAULT '',
    exposure INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    hints INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    mastery DOUBLE PRECISION NOT NULL DEFAULT 0,
    next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (course_id, concept)
);
CREATE INDEX IF NOT EXISTS idx_cs_concepts_course ON cs_concepts(course_id);
