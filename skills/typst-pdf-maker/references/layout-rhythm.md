# Paragraph and Section Rhythm

Read this reference only for a skill-owned native report, an agent-owned multi-paragraph component, an explicit rhythm restyle, or diagnosis of an agent-owned rhythm problem. Do not apply these profiles to venue templates, slides, résumés, invoices, cards, dense reference sheets, captions, tables, lists, or package internals unless the user requests a redesign and the relevant public style API has been checked.

## Authority and built-in defaults

Apply style authority in this order: user, publication, legal, or brand constraints; selected-template global styles; imported-package public parameters and component styles; skill- or agent-owned theme; then the generic profiles below. Preserve template- and package-owned `par`, `heading`, `page`, and `block` rules by default.

| Layer | Current rhythm responsibility |
|---|---|
| `assets/report-theme.typ` | Owns the R4 report profile and T1 longform profile. It exposes `rhythm`, `body-size`, `paragraph-spacing`, and `first-line-indent` overrides. |
| `assets/report-entry.typ` | Selects `rhythm: "report"`; body paragraphs have no first-line indent. |
| `assets/markdown-entry.typ` | Uses the shared report rhythm while explicitly retaining no indentation for Markdown block separation. |

These are skill-owned defaults, not rules for Universe templates or existing Typst projects.

## Relative model

Use `B = body-size` as the root unit. Store paragraph gaps, line leading, heading sizes, and heading spacing as multiples of `B`, then compute actual Typst lengths as `ratio * body-size`. This preserves the intended rhythm when the body changes from, for example, 10 pt to 12 pt.

For each heading level, treat `before` and `after` as different semantic signals:

- `before` separates the new section from what precedes it.
- `after` binds the heading to its first paragraph or content block.
- Require `before > after` in ordinary prose.
- Keep `after` near or slightly above the normal paragraph gap when the next block is prose. A smaller value may be appropriate before a subtitle, deck, or deliberately attached metadata line.

## Built-in profiles

### R4 — report default: chapter emphasis

Use R4 for professional reports, consulting material, research explanations, and structured business documents. It gives H1/H2 stronger section separation while keeping H3/H4 close enough for documents with many local subsections.

| Value, in multiples of `B` | Paragraph | H1 | H2 | H3 | H4 |
|---|---:|---:|---:|---:|---:|
| Font size | `1.00` | `1.55` | `1.30` | `1.13` | `1.00` |
| Before | — | `2.38` | `1.64` | `1.13` | `0.96` |
| After | `0.84` gap | `1.04` | `0.92` | `0.86` | `0.84` |
| Leading | `0.87` | — | — | — | — |
| First-line indent | `0` | — | — | — | — |

### T1 — longform default: no indent

Use T1 for book-like manuscripts, long formal explanations, and continuous academic or humanities prose when paragraph boundaries should remain visible without indentation. It deliberately replaces the former `0.15B` paragraph gap, which could make adjacent paragraphs appear joined.

| Value, in multiples of `B` | Paragraph | H1 | H2 | H3 | H4 |
|---|---:|---:|---:|---:|---:|
| Font size | `1.00` | `1.55` | `1.30` | `1.13` | `1.00` |
| Before | — | `2.15` | `1.48` | `1.10` | `0.88` |
| After | `0.65` gap | `0.88` | `0.68` | `0.58` | `0.52` |
| Leading | `0.82` | — | — | — | — |
| First-line indent | `0` | — | — | — | — |

T1 intentionally allows H3/H4 `after` values slightly below the normal paragraph gap. This makes small subheads feel attached to their first paragraph while the stronger `before` value still marks the section boundary.

## Optional report alternatives

Use these only after a dense-page comparison. Values are `paragraph gap / leading`; heading cells are `before / after`, all relative to `B`.

| Code | Intended effect | P / leading | H1 | H2 | H3 | H4 | Indent |
|---|---|---:|---:|---:|---:|---:|---:|
| R1 | Original spacious anchor | `0.90 / 0.90` | `2.35 / 1.10` | `1.70 / 0.96` | `1.25 / 0.91` | `1.02 / 0.90` | `0` |
| R2 | Lightly condensed report | `0.84 / 0.87` | `2.22 / 1.02` | `1.60 / 0.91` | `1.19 / 0.86` | `0.98 / 0.84` | `0` |
| R3 | Moderately condensed report | `0.78 / 0.84` | `2.08 / 0.95` | `1.50 / 0.86` | `1.13 / 0.80` | `0.94 / 0.78` | `0` |

## Practical application rules

1. **Keep headings with content.** Set heading blocks to `sticky: true` and `breakable: false`, then inspect page bottoms. A heading must not be stranded without meaningful following content.
2. **Use different spacing by level.** H1/H2 should create stronger structural breaks than H3/H4. Do not scale every level by one fixed multiplier; local subheads occur more frequently and otherwise fragment the page.
3. **Inspect consecutive headings.** A title followed immediately by a subtitle or lower-level heading can accumulate or collapse spacing differently from a heading followed by prose. Add a local rule for that pair instead of weakening the global profile.
4. **Inspect neighbouring blocks.** Lists, tables, figures, equations, callouts, and code blocks already carry inset or block spacing. Verify the combined boundary and locally reduce only the duplicated side.
5. **Test wrapped headings.** A two-line heading is taller even when `before` and `after` are unchanged. Check that the wrapped block still feels attached to the following paragraph and does not dominate the page.
6. **Treat page starts separately.** A large `before` value may be unnecessary when the heading begins a new page or follows an explicit chapter break. Prefer a chapter-page rule or local suppression rather than reducing all H1 spacing.
7. **Keep paragraph identity visible.** With no indent, use a clearly visible `par.spacing`; with an indent, avoid making both signals equally strong. Never return to a nearly invisible gap merely to imitate print convention.
8. **Respect script and font metrics.** Compare CJK-only, Latin-only, and mixed-script paragraphs after changing fonts. Equal numeric leading can look different because x-height, ideographic em-box use, and punctuation density differ.
9. **Scale from body size, then visually verify.** Relative ratios protect the system when `B` changes, but they do not replace inspection. Test at least the smallest and largest supported body sizes.
10. **Do not override external owners.** Apply these profiles locally to skill-owned content. For a package or venue template, use its public parameters or preserve its global typography.

## Apply and verify

Use the built-in theme as follows:

```typst
// Default R4 report rhythm
#show: report-theme.with(rhythm: "report")

// T1 longform rhythm
#show: report-theme.with(rhythm: "longform")
```

Prefer a local `#set par(...)` or local theme wrapper inside an agent-owned component over a document-wide override. After any change, render at least one dense page plus one stress page containing a long title, a page-bottom heading, consecutive headings, a list or table, and multiple adjacent paragraphs. Confirm that paragraph boundaries remain visible, section changes are stronger than paragraph changes, and the page forms neither a fragmented stack nor a text wall.

## References

1. [Typst `par` reference](https://typst.app/docs/reference/model/par/)
2. [Typst `heading` reference](https://typst.app/docs/reference/model/heading/)
3. [Typst `block` reference](https://typst.app/docs/reference/layout/block/)
