// Native professional report entry.
// Prepared projects receive report-theme.typ beside this file.

#import "report-theme.typ": report-accent, report-theme

#show: report-theme.with(
  title: "{{TITLE}}",
  author: "{{AUTHOR}}",
  rhythm: "report",
  running-header: true,
)

// ---------- Title page ----------
#page(margin: (top: 30%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #text(size: 26pt, weight: "bold", fill: report-accent)[{{TITLE}}]
    #v(0.5em)
    #text(size: 14pt, fill: luma(80))[{{SUBTITLE}}]
    #v(2em)
    #line(length: 40%, stroke: 0.5pt + luma(160))
    #v(2em)
    #text(size: 12pt)[
      作者: {{AUTHOR}} \
      日期: #datetime.today().display("[year] 年 [month] 月 [day] 日")
    ]
  ]
]

// ---------- Table of contents ----------
#page(numbering: none, header: none)[
  #outline(title: [目 录], indent: 1.5em)
]

// ---------- Main body ----------
#counter(page).update(1)

= 引言

请从这里开始撰写正文。
