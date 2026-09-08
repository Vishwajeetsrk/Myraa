---
name: commercial-agreement-tabular-review
title: "Commercial Agreement Tabular Review"
description: "Use this workflow to review uploaded documents and extract structured information into the tabular review columns def..."
category: "File & Document Management"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["agreement", "automation", "commercial", "file", "myraa-skill", "review"]
---

# Commercial Agreement Tabular Review

# Commercial Agreement Tabular Review

## Purpose

Use this workflow to review uploaded documents and extract structured information into the tabular review columns defined in `table-columns.yaml`.

## Instructions

- Apply each column prompt in `table-columns.yaml` to each document independently.
- Extract only information supported by the document text.
- Include clause references, section names, dates, amounts, party names, and defined terms where available.
- If responsive information is not found, return an empty value or a concise "Not found" response.
- Keep cell outputs concise while including enough context to make each extracted value useful.
- Do not invent citations, facts, parties, dates, rights, obligations, or financial consequences.
- Render the completed results as an exportable Excel (`.xlsx`) file. If Excel output is not possible, render the results as a Markdown table.
