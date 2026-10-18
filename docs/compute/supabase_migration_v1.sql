-- ============================================================================
-- MYRAA consolidated migration v1 — Supabase/Postgres (Phase 8)
-- Covers: Course Studio (Phase 2), learner model (Phase 6), Compute (Phase 7).
-- Awareness consent/mode stay as local JSON files (single-user device state).
-- Idempotent: every statement uses IF NOT EXISTS. No down-migration is
-- provided yet; tables are additive and inert without their routers.
-- SQLite differences handled: TEXT PKs kept; ISO-8601 TEXT timestamps become
-- TIMESTAMPTZ; JSON TEXT becomes JSONB; SQLite REAL becomes DOUBLE PRECISION;
-- AUTOINCREMENT (cp_events.seq) becomes GENERATED ALWAYS AS IDENTITY.
-- Verify on live Postgres before use (marked NEEDS_LIVE_PG_VERIFY).
-- ============================================================================

-- ── Course Studio (Phase 2) ───────────────────────────────────────────────
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

-- ── Learner model (Phase 6) ───────────────────────────────────────────────
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

-- ── Compute (Phase 7) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cp_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL DEFAULT '',
    route TEXT NOT NULL DEFAULT 'AUTO',
    provider TEXT NOT NULL DEFAULT '',
    worker_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'CREATED',
    progress TEXT NOT NULL DEFAULT 'UNKNOWN',
    spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    estimate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    artifacts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    transport TEXT NOT NULL DEFAULT 'file',
    kernel_ref TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cp_workers (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'kaggle',
    status TEXT NOT NULL DEFAULT 'offline',
    caps_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    redactions INTEGER NOT NULL DEFAULT 0,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cp_events (
    seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_events_job ON cp_events(job_id);
