# Typst Common Layout Patterns and Components

Note: code comments are in English; Chinese strings inside examples are intentional sample content demonstrating CJK typesetting.

## 1. Global Configuration and Fonts (CJK + Latin)

```typst
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, x: 2.2cm))
#set page(fill: rgb("#ffffff"))  // page background COLOR → use 'fill'
// page(background: content) is for a content layer behind text (e.g. watermarks)

#set text(
  font: ("Libertinus Serif", "Noto Serif CJK SC"), // Latin first, CJK as fallback
  size: 11pt,
  lang: "zh",
  region: "cn",
)
#set par(justify: true, leading: 0.87em, spacing: 0.84em, first-line-indent: 0em)
// R4 report paragraph values; use report-theme.typ for the full H1–H4 rhythm.
// par accepts: justify, leading, spacing, first-line-indent, hanging-indent, linebreaks
// par does NOT have: orphan, widow, widows, orphans (these do not exist in Typst)

#show figure: set block(breakable: true)  // allow long tables/figures to break across pages
```

## 2. Title Page and Table of Contents

```typst
#page(margin: (top: 30%, x: 2.2cm), numbering: none)[
  #align(center)[
    #text(size: 26pt, weight: "bold")[主标题]
    #v(1em)
    #text(size: 14pt, fill: luma(80))[副标题]
  ]
]

#page(numbering: none)[
  #outline(title: [目 录], indent: 1.5em)
]
```

## 3. Header and Footer

```typst
#set page(
  numbering: "1",
  header: context {
    if counter(page).get().first() > 0 [
      #set text(size: 9pt, fill: luma(100))
      #grid(columns: (1fr, 1fr),
        align(left)[文档标题],
        align(right)[章节名称],
      )
      #v(-0.6em)
      #line(length: 100%, stroke: 0.4pt + luma(180))
    ]
  },
)
```

## 4. Booktabs-style (Three-line) Tables

Use `#figure(table(...))` for short tables that fit on a single page. The `figure` wrapper provides automatic numbering, captions, and cross-reference labels.

```typst
#figure(
  table(
    columns: (1.5fr, 1fr, 1fr, 1fr),
    stroke: none,
    table.hline(stroke: 1pt),
    table.header[*列1*][*列2*][*列3*][*列4*],
    table.hline(stroke: 0.5pt),
    [数据1], [数据2], [数据3], [数据4],
    [数据5], [数据6], [数据7], [数据8],
    table.hline(stroke: 1pt),
  ),
  caption: [表格标题],
) <tab-label>
```

### 4b. Long Tables (Cross-Page with Header Repeat)

By default, `figure` prevents page breaks within its content. To allow a long table to break across pages while keeping its caption and label, make figures breakable:

```typst
// Place this once near the top of your file, after global styles
#show figure: set block(breakable: true)

// Long table — still inside figure() for caption + label + cross-reference
#figure(
  table(
    columns: (1fr, 1.5fr, 3fr),
    stroke: none,
    inset: (x: 8pt, y: 6pt),
    fill: (_, y) => if y > 0 and calc.even(y) { luma(245) } else { none },
    table.hline(stroke: 1.2pt),
    table.header(
      [*Year*], [*Category*], [*Description*],
    ),
    table.hline(stroke: 0.6pt),
    [1952], [Birth], [Born in Beijing...],
    [1968], [Event], [Sent to Yunnan...],
    // ... 20+ more rows ...
    table.hline(stroke: 1.2pt),
  ),
  caption: [Long Table Caption],
) <tab-long>
```

`table.header()` rows automatically repeat on each continuation page. The `breakable: true` rule applies to all figures globally — short tables and images are unaffected (they simply never need to break).

## 5. Images and Placeholders

```typst
// Insert a local image
#figure(image("path/to/image.png", width: 80%), caption: [图片标题]) <fig-label>

// Placeholder block (use when the image is not ready yet)
#figure(
  rect(width: 80%, height: 4cm, fill: rgb("#f0f0f0"))[
    #align(center + horizon)[#text(fill: luma(100))[占位图区域]]
  ],
  caption: [占位图标题],
)
```

## 6. Image Positioning Strategy

Choose the right method based on the layout need:

| Layout need | Method | Notes |
|---|---|---|
| Image on its own line (default, 90% of cases) | `#figure(image(...))` | Typst manages page placement automatically. Most stable across content changes. |
| Text wraps around image (side-by-side) | `wrap-it` package | Use `wrap-content` for true CSS-float-like text wrapping. |
| Fixed position on a known page (cover logo, watermark) | `#place(...)` | Only for pages you fully control (cover, chapter title pages). |

### Text wrapping with `wrap-it`

```typst
#import "@preview/wrap-it:0.1.1": wrap-content

// Right-aligned image with text wrapping around it
#let fig = figure(
  image("portrait.png", width: 4cm),
  caption: [Caption text],
)
// NOTE: Labels CANNOT be attached to `let` bindings — they only attach to
// content elements. To label a wrapped figure, place the label after the
// wrap-content call:
#wrap-content(fig, align: right, column-gutter: 1em)[
  This paragraph text will flow around the image on the left side.
  Continue writing normally — the text wraps automatically.
] <fig-wrapped-portrait>
```

### Anti-pattern: `#place` for images in flowing text

**Never use `#place(...)` for images in the normal content flow.** `#place` is
an absolute positioning primitive — it does NOT push text aside or interact
with text reflow. The positioned element renders at the current flow insertion
point, which shifts unpredictably across pages as content length changes. An
image that appears next to the right paragraph today will drift to the
previous or next page after a single sentence is added elsewhere.

Reserve `#place` exclusively for elements on pages whose content you fully
control (cover page logos, decorative backgrounds, watermarks, chapter title
page ornaments).

## 6b. Columns and Page Breaks

Choose the right column strategy:

| Need | Method | Notes |
|---|---|---|
| Entire page in multi-column layout | `#set page(columns: 2)` | Normal `#pagebreak()` and footnotes still work. |
| Local multi-column block within a page | `#columns(2, gutter: 1.5em)[...]` | Content is confined to the container. |

**CRITICAL**: `#pagebreak()` is FORBIDDEN inside `#columns(...)` or any other block container. Typst will emit: `error: pagebreaks are not allowed inside of containers`. Use `#colbreak()` to break to the next column within a container.

```typst
// Correct usage
#columns(2, gutter: 1.5em)[
  第一栏内容。
  #colbreak()   // breaks to the next column
  第二栏内容。
]

#pagebreak()    // MUST be outside the columns container
```

### Anti-pattern: `#pagebreak()` inside containers

```typst
// WRONG — will cause a compilation error
#columns(2)[
  Some text.
  #pagebreak()  // ❌ error: pagebreaks are not allowed inside of containers
]
```

## 6c. Blockquote / Callout Box

Typst has NO built-in `blockquote` function. Implement quote blocks using `#block` with a left border stroke:

```typst
// Standard blockquote style
#block(
  width: 100%,
  inset: (left: 1.2em, rest: 0.8em),
  stroke: (left: 3pt + rgb("#1a5fb4")),
  fill: rgb("#f0f4ff"),
)[
  "一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。" — 王小波
]

// Colored callout box
#block(
  width: 100%, inset: 10pt, radius: 4pt,
  fill: rgb("#fff3e0"), stroke: (left: 4pt + rgb("#e65100")),
)[
  *注意：* 这是一个警告样式的 callout box。
]
```

## 7. Math and Code

```typst
// Inline equation
在文本中直接使用 $a^2 + b^2 = c^2$ 即可。

// Block equation (numbered)
#set math.equation(numbering: "(1)")
$ E = m c^2 $ <eq-mass>

// Syntax-highlighted code block
```python
def hello():
    print("Hello Typst!")
```
```

## 8. Cross-references and Footnotes

```typst
正如在 @fig-label 中看到的，以及参考 @eq-mass 的推导。
这是一段需要解释的文本#footnote[这是底部的脚注内容。]。
```

## 9. External Packages (Typst Universe)

No manual installation needed; `import` at the top of the file and Typst downloads the package automatically at compile time:

```typst
// Charts and plots
#import "@preview/cetz:0.5.2": canvas
#import "@preview/cetz-plot:0.1.3": chart

// Third-party resume template
#import "@preview/basic-resume:0.2.9": *

// Render existing Markdown directly (with LaTeX math support)
#import "@preview/cmarker:0.1.10"
#import "@preview/mitex:0.2.7": mitex
#cmarker.render(read("doc.md"), math: mitex)

// Text wrapping (float-like image positioning)
#import "@preview/wrap-it:0.1.1": wrap-content
```

## 10. Colors and Transparency

Typst has no global `opacity()` function. Transparency and color manipulation are methods on color values:

```typst
#let accent = rgb("#1a5fb4")

// Transparency: 0% = fully opaque, 100% = fully transparent
#text(fill: accent.transparentize(80%))[Semi-transparent watermark]

// Lighten and darken
#text(fill: accent.lighten(40%))[Lighter]
#text(fill: accent.darken(20%))[Darker]

// Mix two colors
#box(width: 2cm, height: 0.5cm, fill: color.mix(red, blue))
```

For page-level watermarks, use `page(background:)` with content (not a color):

```typst
#set page(background: place(center + horizon,
  text(size: 60pt, fill: luma(230), weight: "bold")[DRAFT]
))
```

## 11. Special Characters and Escaping

In content mode, these characters trigger special parsing. To display them literally, prefix with `\`:

```typst
\#   // literal # (otherwise enters code mode)
\*   // literal * (otherwise starts bold)
\_   // literal _ (otherwise starts italic)
\$   // literal $ (otherwise enters math mode)
\@   // literal @ (otherwise starts a reference)
```
