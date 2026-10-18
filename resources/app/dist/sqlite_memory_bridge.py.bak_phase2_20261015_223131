import sys, json, sqlite3, os
from datetime import datetime

base_dir = os.environ.get("MYRAA_DATA_DIR")
if base_dir:
    db_path = os.path.join(base_dir, "memory", "myraa_memory.db")
else:
    db_path = os.path.expandvars(r"%APPDATA%\MYRAA\memory\myraa_memory.db")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

conn = sqlite3.connect(db_path, timeout=5.0)
conn.execute("PRAGMA journal_mode=WAL;")
conn.execute("PRAGMA synchronous=NORMAL;")

conn.execute("""
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    status_json TEXT,
    updated_at TEXT
);
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS app_knowledge (
    app_name TEXT PRIMARY KEY,
    control_map_json TEXT,
    learned_actions_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS project_index (
    name TEXT PRIMARY KEY,
    description TEXT,
    project_dir TEXT NOT NULL,
    toolchain TEXT,
    registered_at TEXT NOT NULL
);
""")

conn.execute("CREATE INDEX IF NOT EXISTS idx_mem_category ON memories(category);")
conn.execute("CREATE INDEX IF NOT EXISTS idx_proj_name ON project_index(name);")

cmd = sys.argv[1] if len(sys.argv) > 1 else "list"

try:
    if cmd == "list":
        cat = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "all" else None
        if cat:
            cur = conn.execute("SELECT id, category, text, created_at, updated_at FROM memories WHERE category=? ORDER BY updated_at DESC", (cat,))
        else:
            cur = conn.execute("SELECT id, category, text, created_at, updated_at FROM memories ORDER BY updated_at DESC")
        rows = [{"id": r[0], "category": r[1], "text": r[2], "createdAt": r[3], "updatedAt": r[4]} for r in cur.fetchall()]
        print(json.dumps(rows))

    elif cmd == "save":
        payload = json.loads(sys.argv[2])
        m_id = payload.get("id") or f"mem_{int(payload.get('time', 0)) or os.getpid()}"
        cat = payload.get("category", "preference")
        txt = payload.get("text", "")
        now = payload.get("updatedAt") or payload.get("createdAt") or datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO memories (id, category, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET category=excluded.category, text=excluded.text, updated_at=excluded.updated_at",
            (m_id, cat, txt, now, now)
        )
        conn.commit()
        print(json.dumps({"ok": True, "id": m_id}))

    elif cmd == "delete":
        m_id = sys.argv[2]
        conn.execute("DELETE FROM memories WHERE id=?", (m_id,))
        conn.commit()
        print(json.dumps({"ok": True, "deleted": m_id}))

    # ── APP KNOWLEDGE EXTENSIONS ───────────────────────────────────────────────
    elif cmd == "app_knowledge_get":
        app_name = sys.argv[2] if len(sys.argv) > 2 else ""
        cur = conn.execute("SELECT app_name, control_map_json, learned_actions_json, created_at, updated_at FROM app_knowledge WHERE LOWER(app_name)=LOWER(?)", (app_name,))
        row = cur.fetchone()
        if row:
            res = {
                "appName": row[0],
                "controlMap": json.loads(row[1]) if row[1] else [],
                "learnedActions": json.loads(row[2]) if row[2] else [],
                "createdAt": row[3],
                "updatedAt": row[4]
            }
            print(json.dumps({"ok": True, "data": res}))
        else:
            print(json.dumps({"ok": False, "error": "Not found"}))

    elif cmd == "app_knowledge_save":
        payload = json.loads(sys.argv[2])
        app_name = payload.get("appName") or payload.get("app_name") or "unknown_app"
        controls_json = json.dumps(payload.get("controlMap") or payload.get("controls") or [])
        actions_json = json.dumps(payload.get("learnedActions") or payload.get("actions") or [])
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO app_knowledge (app_name, control_map_json, learned_actions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(app_name) DO UPDATE SET control_map_json=excluded.control_map_json, learned_actions_json=excluded.learned_actions_json, updated_at=excluded.updated_at",
            (app_name, controls_json, actions_json, now, now)
        )
        conn.commit()
        print(json.dumps({"ok": True, "appName": app_name}))

    elif cmd == "app_knowledge_list":
        cur = conn.execute("SELECT app_name, created_at, updated_at FROM app_knowledge ORDER BY updated_at DESC")
        rows = [{"appName": r[0], "createdAt": r[1], "updatedAt": r[2]} for r in cur.fetchall()]
        print(json.dumps({"ok": True, "apps": rows}))

    # ── PROJECT INDEX EXTENSIONS ──────────────────────────────────────────────
    elif cmd == "project_index_get":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        cur = conn.execute("SELECT name, description, project_dir, toolchain, registered_at FROM project_index WHERE LOWER(name)=LOWER(?)", (name,))
        row = cur.fetchone()
        if row:
            print(json.dumps({
                "ok": True,
                "project": {
                    "name": row[0],
                    "description": row[1],
                    "projectDir": row[2],
                    "toolchain": row[3],
                    "registeredAt": row[4]
                }
            }))
        else:
            print(json.dumps({"ok": False, "error": "Not found"}))

    elif cmd == "project_index_save":
        payload = json.loads(sys.argv[2])
        name = payload.get("name")
        desc = payload.get("description", "")
        pdir = payload.get("projectDir") or payload.get("project_dir", "")
        tool = payload.get("toolchain", "unknown")
        now = payload.get("registeredAt") or datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO project_index (name, description, project_dir, toolchain, registered_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(name) DO UPDATE SET description=excluded.description, project_dir=excluded.project_dir, toolchain=excluded.toolchain, registered_at=excluded.registered_at",
            (name, desc, pdir, tool, now)
        )
        conn.commit()
        print(json.dumps({"ok": True, "name": name}))

    elif cmd == "project_index_list":
        cur = conn.execute("SELECT name, description, project_dir, toolchain, registered_at FROM project_index ORDER BY registered_at DESC")
        rows = [{
            "name": r[0],
            "description": r[1],
            "projectDir": r[2],
            "toolchain": r[3],
            "registeredAt": r[4]
        } for r in cur.fetchall()]
        print(json.dumps({"ok": True, "projects": rows}))

    else:
        print(json.dumps({"ok": False, "error": f"Unknown command: {cmd}"}))

except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))

finally:
    conn.close()
