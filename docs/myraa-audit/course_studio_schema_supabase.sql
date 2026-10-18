-- MYRAA Course Studio — Supabase/Postgres DDL (Phase 2, for later migration)
-- Mirrors the SQLite tables added to sqlite_memory_bridge.py.
-- SQLite stores JSON documents as TEXT; on Postgres use JSONB.
-- SQLite ISO-8601 TEXT timestamps map to TIMESTAMPTZ.

CREATE TABLE IF NOT EXISTS cs_courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    objective TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL DEFAULT 'topic',
    source_ref TEXT NOT NULL DEFAULT '',
    source_text TEXT NOT NULL DEFAULT '',
    compute TEXT NOT NULL DEFAULT 'AUTO',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','outline-ready','ready','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cs_lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES cs_courses(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    objective TEXT NOT NULL DEFAULT '',
    module_title TEXT NOT NULL DEFAULT '',
    scenes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    narration_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    quiz_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'outline' CHECK (status IN ('outline','building','ready','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cs_lessons_course ON cs_lessons(course_id);

CREATE TABLE IF NOT EXISTS cs_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'generic',
    ref_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','cancelled','failed','completed')),
    steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cs_progress (
    course_id TEXT PRIMARY KEY REFERENCES cs_courses(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL DEFAULT '',
    mastery_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
