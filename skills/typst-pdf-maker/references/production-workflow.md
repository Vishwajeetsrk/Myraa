# Production workflow and context control

Read this reference once after routing when authoring, compiling, repairing, or verifying a non-trivial document. Do not reload it during every edit cycle.

## Gate model

1. **Plan once after discovery.** Inspect the source and acceptance criteria, complete the compact manifest, run the deterministic planner, resolve its one recorded question when needed, and run one minimum compile preflight for the selected base.
2. **Author a coherent batch.** Complete a dependency-closed section or one set of related edits before compiling. Compile earlier only when a global style owner, cross-reference graph, package API, page geometry, or other high-risk dependency needs confirmation.
3. **Compile once per gate.** Use discrete compile by default. Do not use watch for autonomous editing. Watch is only for an explicitly requested human continuous-editing session.
4. **Classify diagnostics before repair.** Group diagnostics by likely root cause. If one syntax or import error can create cascades, repair that root error first; otherwise repair all independent diagnostics from the same compile in one batch.
5. **Run deterministic PDF verification.** Use `scripts/verify_pdf.py` with the verification profile implied by the document. Save JSON as an artifact and keep only its one-line summary in conversational context. A `PASS` replaces separate `pdfinfo`, `pdftotext`, `pdffonts`, and `pdfimages` checks already covered by the selected profile.
6. **Review visual evidence proportionally.** During iteration inspect changed pages, one adjacent reflow page on each side, TOC/cross-reference pages when affected, and pages containing high-risk tables, figures, columns, long headings, or dense CJK text.
7. **Finish with standard evidence by default.** Run strict compile, deterministic verification, and the standard visual-review mode. Escalate to exhaustive review only after an explicit trigger in this reference.

## Plan freeze and rerun contract

Freeze `.typst-build-plan.json` when base initialization or authoring begins. Reuse the frozen plan during authoring, repair, verification, and local visual revision. Rerun the planner only to resolve its recorded `ambiguous` or `needs-confirmation` question, after a user or publication hard constraint changes, or after an explicitly recorded `blocked` or `patch-required` condition changes. A late optional visual idea, a local style preference, or discovery of a package that is not required for correctness is not a rerouting reason.

## Visual review modes

| Mode | When to use | Required evidence |
|---|---|---|
| `standard` | Default for ordinary reports, papers, resumes, and structured documents. | One deterministic contact sheet covering representative and high-risk pages, followed by individual-page inspection only for pages that show a concern. |
| `exhaustive` | Use only when the user explicitly requests every-page inspection, sampled pages reveal a systemic defect, the verifier reports an anomaly needing visual diagnosis, or theme, page-geometry, or global-pagination changes invalidate the sample. | Every delivered page is represented in contact sheets; inspect individual pages when thumbnails are insufficient for the relevant risk. |

Use `scripts/render_review.py` instead of writing a task-specific rendering or contact-sheet script. Standard mode automatically selects the first and last pages plus evenly spaced interior pages; add TOC, cross-reference, dense CJK, table, figure, column, or other high-risk pages with repeated `--page` arguments. Use `--all-pages` only for exhaustive mode. The script writes a compact review manifest containing the mode, page count, selected pages, rendered images, and contact-sheet paths.

After a local visual edit, render only the changed pages, one adjacent reflow page on each side, and navigation pages affected by that edit. Do not regenerate or reread unchanged contact sheets. Upgrade the next pass to exhaustive only when page count, page geometry, theme ownership, or global flow changes, or when the sampled evidence reveals a systemic defect.

## Context hygiene

Keep full compiler diagnostics, verifier JSON, and the review manifest in project artifacts. Return only bounded summaries to the conversation unless the summary is insufficient to identify the root cause. Do not repeatedly read whole source files, whole logs, all rendered pages, the routing catalog, or unchanged contact sheets after their relevant portions are known. Reuse the existing build plan when its fingerprint matches.

Never store full stderr, extracted PDF text, page images, or prose work notes in a state file. State may contain only bounded enums, fingerprints, artifact paths, checked-page numbers, and the current error class. Do not create a prose visual-review report unless the user requests it.

## Diagnostic policy

`generate_pdf.py` uses Typst short diagnostics by default and writes the complete diagnostic stream from that compile to an artifact. Use `--diagnostics full` only when the short stream lacks enough source context. Do not run a second full-diagnostic compile automatically after a short-diagnostic compile. Strict mode evaluates the complete, untruncated stream even though terminal output is bounded.

## Verification profiles

| Profile | Deterministic checks |
|---|---|
| `general` | PDF signature, parseability, page count, page size consistency, metadata presence when expected, placeholder markers, and tool availability |
| `text-document` | `general` plus non-empty extracted text and font inventory |
| `image-bearing` | `general` plus expected minimum image count |
| `publication` | `text-document` plus expected page-size and required metadata constraints |

A missing external inspection tool is `UNKNOWN`, not `PASS`. Run only the direct inspection command needed to diagnose a reported `FAIL`, `WARN`, or `UNKNOWN`, or to test a requirement the verifier does not represent. A verifier cannot judge overlap, clipping, hierarchy, or aesthetic quality; these remain visual-review responsibilities.

## Default delivery scope

Deliver the requested PDF and only the additional artifacts explicitly required by the user or acceptance criteria. Do not generate a coverage report, README, source archive, or prose visual-review notes by default. Keep build plans, diagnostic logs, verifier JSON, and review manifests in the working project unless the user requests them.

## Escalation rules

Escalate from short to full diagnostics only when the first stream cannot identify the root cause. Expand visual review from standard to exhaustive only when the user explicitly requests it, pagination changes globally, the page geometry or theme owner changes, the verifier reports an anomaly needing visual diagnosis, or sampled pages reveal a systemic defect. These are evidence-based review triggers, not fixed compile, page, or token budgets.
