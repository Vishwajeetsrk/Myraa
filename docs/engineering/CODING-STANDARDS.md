# MYRAA Coding Standards

## Core Tenets

1. **Strict Non-Destructive Modifiers**:
   - Never run destructive file system commands (`rm -rf`, `del /f /s /q`) on user directories.
   - Code refactorings must be surgical, preserving surrounding code, comments, and structure.

2. **Zero-Emoji Enforcement**:
   - Never embed emojis (Unicode `U+1F000+`) in strings, UI elements, logs, or comments.
   - Use approved SVG vectors or ASCII symbols (`[OK]`, `[!]`, `[*]`, `[+]`, `[-]`, `[>]`).

3. **Dynamic Version Binding**:
   - Read version from `version.json` or `package.json` at runtime.
   - Do not hardcode static version literals into user interfaces or API responses.

4. **Robust Error Handling**:
   - All async operations must be wrapped in `try/catch` blocks.
   - Express route handlers must return structured error JSON (`{ ok: false, error: err.message }`) with appropriate HTTP status codes (400 for bad input, 404 for not found, 500 for server exceptions).

5. **Path Portability**:
   - Never hardcode absolute paths (`c:\Users\...`).
   - Use `path.join(__dirname, ...)` or relative environment configurations for portable cross-platform execution.
