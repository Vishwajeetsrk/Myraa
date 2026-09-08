#!/usr/bin/env python3
"""Create or reuse a deterministic Typst build plan from a content manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from copy import deepcopy
from pathlib import Path
from typing import Any

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = SKILL_DIR / "references" / "routing-catalog.json"
DEFAULT_OUTPUT = Path(".typst-build-plan.json")


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"JSON file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"Top-level JSON value must be an object: {path}")
    return value


def detect_typst_version() -> str:
    try:
        result = subprocess.run(
            ["typst", "--version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return "unavailable"
    return result.stdout.strip() or "unknown"


def fingerprint(
    manifest: dict[str, Any],
    catalog_version: str,
    typst_version: str,
) -> str:
    payload = {
        "manifest": manifest,
        "catalog_version": catalog_version,
        "typst_version": typst_version,
    }
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def feature_meets(features: dict[str, Any], triggers: dict[str, Any]) -> bool:
    for key, wanted in triggers.items():
        actual = features.get(key)
        if isinstance(wanted, bool):
            if not isinstance(actual, bool) or actual is not wanted:
                return False
        elif isinstance(wanted, (int, float)):
            if not isinstance(actual, (int, float)) or actual < wanted:
                return False
        elif actual != wanted:
            return False
    return True


def public_item(entry: dict[str, Any], reason: str, auto_apply: bool) -> dict[str, Any]:
    keys = (
        "id",
        "kind",
        "version",
        "path",
        "ownership",
        "conflict_group",
        "adoption",
        "status",
        "fidelity_warning",
        "compliance_warning",
        "institution_warning",
        "patch_note",
        "block_reason",
    )
    item = {key: entry[key] for key in keys if key in entry}
    if "version" in item:
        item["universe_ref"] = f"@preview/{item['id']}:{item['version']}"
    item["reason"] = reason
    item["auto_apply"] = auto_apply
    return item


def match_entries(
    entries: list[dict[str, Any]],
    signals: set[str],
    field: str,
) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for entry in entries:
        negative = set(entry.get("negative_signals", []))
        if signals & negative:
            continue
        if signals & set(entry.get(field, [])):
            matches.append(entry)
    return matches


def base_plan(
    fp: str,
    catalog_version: str,
    typst_version: str,
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "fingerprint": fp,
        "catalog_version": catalog_version,
        "typst_version": typst_version,
        "reused": False,
        "channel": "typst-pdf",
        "state": "ready",
        "base": None,
        "enhancements": [],
        "optional_idea": None,
        "confirmation_candidates": [],
        "exclusions": [],
        "question": None,
        "next_action": "minimal-compile-preflight",
    }


def choose_base(
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    plan: dict[str, Any],
) -> dict[str, Any]:
    task_kind = str(manifest.get("task_kind", "new-document"))
    output = str(manifest.get("output", "pdf")).lower()
    signals = {str(value) for value in manifest.get("signals", [])}

    if task_kind == "presentation" or output in {"ppt", "pptx", "slides"}:
        plan.update(
            channel="manus-slides-pptx",
            state="redirect",
            reason="Ordinary presentations default to editable Manus Slides/PPTX.",
            next_action="exit-typst-skill",
        )
        return plan

    slide_ids = {"diatypst", "polylux", "touying"}
    explicit_typst_slides = task_kind == "typst-presentation" or bool(
        signals & (slide_ids | {"typst-presentation", "pdf-slides"})
    )
    if explicit_typst_slides:
        candidates = [
            entry
            for entry in catalog["templates"] + catalog["packages"]
            if entry["id"] in slide_ids and entry["id"] in signals
        ]
        if len(candidates) != 1:
            plan.update(
                state="ambiguous",
                question="Choose one Typst slide engine: Diatypst, Polylux, or Touying.",
                next_action="ask-one-question",
            )
            return plan
        selected = public_item(
            candidates[0],
            "Explicit Typst/PDF slide engine request.",
            False,
        )
        if candidates[0] in catalog["templates"]:
            selected["kind"] = "universe-template"
            selected["init_command"] = (
                f"typst init {selected['universe_ref']} <output-dir>"
            )
        else:
            selected["kind"] = "universe-package"
        plan["base"] = selected
        plan["style_owner"] = candidates[0]["id"]
        return plan

    if task_kind == "existing-typst":
        plan["base"] = {
            "id": "existing-project",
            "kind": "existing-project",
            "ownership": "global",
            "reason": "Preserve the user's existing Typst project as the base.",
            "auto_apply": True,
        }
        plan["style_owner"] = "existing-project"
        return plan

    builtins = catalog["builtins"]
    if task_kind == "markdown-to-pdf" or signals & {"markdown-source", "markdown-to-pdf"}:
        entry = next(item for item in builtins if item["id"] == "markdown-entry")
        plan["base"] = public_item(entry, "Existing Markdown source.", True)
        plan["style_owner"] = entry["id"]
        return plan

    templates = catalog["templates"]
    candidates = match_entries(templates, signals, "hard_signals")
    reason = "Explicit template or publication-format signal."
    if not candidates and signals & {"resume", "cv"}:
        plan.update(
            state="ambiguous",
            question="Is this an ATS résumé, an academic CV, or a visual portfolio CV?",
            next_action="ask-one-question",
        )
        return plan
    if not candidates:
        candidates = match_entries(templates, signals, "soft_signals")
        reason = "Document-structure signal uniquely matches a featured template."

    if len(candidates) > 1:
        plan.update(
            state="ambiguous",
            question="Multiple document bases match: "
            + ", ".join(item["id"] for item in candidates)
            + ". Which required format takes priority?",
            next_action="ask-one-question",
        )
        return plan

    if len(candidates) == 1:
        entry = candidates[0]
        selected = public_item(entry, reason, False)
        selected["kind"] = "universe-template"
        selected["init_command"] = (
            f"typst init {selected['universe_ref']} <output-dir>"
        )
        plan["base"] = selected
        plan["style_owner"] = entry["id"]
        if entry["status"] == "blocked":
            plan.update(state="blocked", next_action="stop-before-init")
        elif entry["status"] == "patch-required":
            plan.update(
                state="patch-required",
                next_action="apply-known-patch-then-minimal-compile-preflight",
            )
        return plan

    entry = next(item for item in builtins if item["id"] == "report-entry")
    plan["base"] = public_item(entry, "General professional document fallback.", True)
    plan["style_owner"] = entry["id"]
    return plan


def choose_packages(
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    plan: dict[str, Any],
) -> dict[str, Any]:
    if plan["state"] in {"redirect", "ambiguous", "blocked"}:
        return plan
    if plan.get("base", {}).get("conflict_group") == "slides-engine":
        return plan

    features = manifest.get("content_features", {})
    if not isinstance(features, dict):
        raise SystemExit("manifest.content_features must be an object")
    signals = {str(value) for value in manifest.get("signals", [])}
    constraints = {str(value) for value in manifest.get("hard_constraints", [])}

    required: list[dict[str, Any]] = []
    low_risk: list[dict[str, Any]] = []
    confirmation: list[dict[str, Any]] = []
    exclusions: list[dict[str, str]] = []

    for entry in catalog["packages"]:
        if entry.get("conflict_group") == "slides-engine":
            continue
        if not feature_meets(features, entry.get("triggers", {})):
            continue
        negatives = set(entry.get("negative_signals", []))
        blocked_by = sorted((signals | constraints) & negatives)
        if blocked_by:
            exclusions.append(
                {
                    "id": entry["id"],
                    "reason": "Blocked by: " + ", ".join(blocked_by),
                }
            )
            continue
        reason = "Content evidence satisfies " + json.dumps(
            entry.get("triggers", {}),
            ensure_ascii=False,
            sort_keys=True,
        )
        item = public_item(entry, reason, entry["adoption"] in {"A", "B"})
        item["kind"] = "universe-package"
        if entry["adoption"] == "A":
            required.append(item)
        elif entry["adoption"] == "B":
            low_risk.append(item)
        else:
            item["auto_apply"] = False
            confirmation.append(item)

    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in required + low_risk + confirmation:
        group = item.get("conflict_group")
        if group:
            grouped.setdefault(group, []).append(item)

    for group, items in grouped.items():
        if len(items) < 2:
            continue
        required_items = [item for item in items if item["adoption"] == "A"]
        if len(required_items) == 1:
            winner = required_items[0]
            low_risk = [
                item
                for item in low_risk
                if item.get("conflict_group") != group
            ]
            confirmation = [
                item
                for item in confirmation
                if item.get("conflict_group") != group
            ]
            for item in items:
                if item["id"] != winner["id"]:
                    exclusions.append(
                        {
                            "id": item["id"],
                            "reason": f"Conflict group {group} is owned by {winner['id']}.",
                        }
                    )
            continue
        plan.update(
            state="ambiguous",
            enhancements=required,
            exclusions=exclusions,
            question=f"Choose one capability owner for {group}: "
            + ", ".join(item["id"] for item in items),
            next_action="ask-one-question",
        )
        return plan

    plan["enhancements"] = required
    plan["exclusions"] = exclusions
    if low_risk:
        plan["optional_idea"] = low_risk[0]
        for item in low_risk[1:]:
            plan["exclusions"].append(
                {
                    "id": item["id"],
                    "reason": "Only one unrequested Class B enhancement may be applied.",
                }
            )
    plan["confirmation_candidates"] = confirmation
    if confirmation:
        plan.update(
            state="needs-confirmation",
            question="Confirm structural/style enhancement: "
            + ", ".join(item["id"] for item in confirmation),
            next_action="ask-one-question",
        )
    return plan


def create_plan(
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    typst_version: str,
    previous: dict[str, Any] | None,
) -> dict[str, Any]:
    catalog_version = str(catalog.get("catalog_version", "unknown"))
    fp = fingerprint(manifest, catalog_version, typst_version)
    if previous and previous.get("fingerprint") == fp:
        reused = deepcopy(previous)
        reused["reused"] = True
        reused["next_action"] = "reuse-plan-without-rerouting-or-reloading-catalog"
        return reused

    plan = base_plan(fp, catalog_version, typst_version)
    plan = choose_base(manifest, catalog, plan)
    return choose_packages(manifest, catalog, plan)


def validate_catalog(catalog: dict[str, Any]) -> None:
    expected = {"builtins": 2, "templates": 30, "packages": 43}
    for key, count in expected.items():
        entries = catalog.get(key)
        if not isinstance(entries, list) or len(entries) != count:
            actual = len(entries) if isinstance(entries, list) else "missing"
            raise SystemExit(f"Catalog {key} count must be {count}; got {actual}")
    ids = [
        entry["id"]
        for key in ("builtins", "templates", "packages")
        for entry in catalog[key]
    ]
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        raise SystemExit("Duplicate catalog IDs: " + ", ".join(duplicates))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create or reuse a deterministic Typst build plan."
    )
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--previous-plan", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--typst-version")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    manifest = load_json(args.manifest)
    catalog = load_json(args.catalog)
    validate_catalog(catalog)
    typst_version = args.typst_version or detect_typst_version()

    previous_path = args.previous_plan
    if previous_path is None and args.output.is_file():
        previous_path = args.output
    previous = load_json(previous_path) if previous_path else None

    plan = create_plan(manifest, catalog, typst_version, previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
