#!/usr/bin/env python3
"""Rebuild it/es/pt locale .ts files from translation caches + English schema."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "scripts" / ".en-locale.json"
CACHE_DIR = ROOT / "scripts" / ".i18n-cache"
OUT_DIR = ROOT / "src" / "core" / "i18n" / "locales"
CHUNK_DIR = ROOT / "scripts" / "locale-chunks"

LANG_META = {
    "it": "Italian translation resources",
    "es": "Spanish translation resources",
    "pt": "Portuguese translation resources",
}

PLACEHOLDER_RE = re.compile(r"\{\{[^{}]+\}\}|</?\d+>")


def apply_map(obj, mapping: dict[str, str]):
    if isinstance(obj, str):
        return mapping.get(obj, obj)
    if isinstance(obj, list):
        return [apply_map(x, mapping) for x in obj]
    if isinstance(obj, dict):
        return {k: apply_map(v, mapping) for k, v in obj.items()}
    return obj


def to_ts(lang: str, data: dict) -> str:
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return (
        f"import type {{ TranslationResources }} from '../types';\n\n"
        f"/** {LANG_META[lang]} */\n"
        f"const {lang} = {body} satisfies TranslationResources;\n\n"
        f"export default {lang};\n"
    )


def write_chunks(lang: str, full: dict) -> None:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    for key, value in full.items():
        path = CHUNK_DIR / f"{lang}-{key}.json"
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stats(en, translated) -> tuple[int, int]:
    total = same = 0

    def walk(a, b):
        nonlocal total, same
        if isinstance(a, str):
            total += 1
            if a == b:
                same += 1
        elif isinstance(a, dict):
            for k in a:
                walk(a[k], b[k])
        elif isinstance(a, list):
            for i, x in enumerate(a):
                walk(x, b[i])

    walk(en, translated)
    return total, same


def main() -> None:
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    for lang in LANG_META:
        cache_path = CACHE_DIR / f"{lang}.json"
        if not cache_path.exists():
            print(f"skip {lang}: no cache")
            continue
        mapping = json.loads(cache_path.read_text(encoding="utf-8"))
        # Drop broken placeholder translations
        for src, dst in list(mapping.items()):
            if sorted(PLACEHOLDER_RE.findall(src)) != sorted(PLACEHOLDER_RE.findall(dst)):
                mapping[src] = src
        translated = apply_map(en, mapping)
        write_chunks(lang, translated)
        out = OUT_DIR / f"{lang}.ts"
        out.write_text(to_ts(lang, translated), encoding="utf-8")
        total, same = stats(en, translated)
        print(f"Wrote {out} leaves={total} identical_to_en={same} ({100*same/total:.1f}%)")


if __name__ == "__main__":
    main()
