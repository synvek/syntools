#!/usr/bin/env python3
"""Merge keep-as-is + batch maps + existing caches into final it/es/pt locale files."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "scripts" / ".en-locale.json"
CACHE_DIR = ROOT / "scripts" / ".i18n-cache"
MAP_DIR = CACHE_DIR / "maps"
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
        (CHUNK_DIR / f"{lang}-{key}.json").write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


def load_lang_map(lang: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    # 1) existing MT cache
    cache = CACHE_DIR / f"{lang}.json"
    if cache.exists():
        mapping.update(json.loads(cache.read_text(encoding="utf-8")))
    # 2) keep-as-is list (identity)
    keep_path = CACHE_DIR / "keep.json"
    if keep_path.exists():
        for s in json.loads(keep_path.read_text(encoding="utf-8")):
            mapping.setdefault(s, s)
    # 3) hand maps
    if MAP_DIR.exists():
        for path in sorted(MAP_DIR.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            for en, tr in data.items():
                if isinstance(tr, dict) and lang in tr:
                    mapping[en] = tr[lang]
                elif isinstance(tr, str) and path.stem.startswith(lang):
                    mapping[en] = tr
    # fix placeholders
    for src, dst in list(mapping.items()):
        if sorted(PLACEHOLDER_RE.findall(src)) != sorted(PLACEHOLDER_RE.findall(dst)):
            mapping[src] = src
    return mapping


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
        mapping = load_lang_map(lang)
        # persist merged cache
        (CACHE_DIR / f"{lang}.json").write_text(
            json.dumps(mapping, ensure_ascii=False, indent=0) + "\n", encoding="utf-8"
        )
        translated = apply_map(en, mapping)
        write_chunks(lang, translated)
        out = OUT_DIR / f"{lang}.ts"
        out.write_text(to_ts(lang, translated), encoding="utf-8")
        total, same = stats(en, translated)
        covered = sum(1 for k in _collect(en) if k in mapping and mapping[k] != k or k in mapping)
        print(f"Wrote {out.name}: leaves={total} identical={same} ({100*same/total:.1f}%) map_size={len(mapping)}")


def _collect(obj) -> set[str]:
    out: set[str] = set()

    def walk(o):
        if isinstance(o, str):
            out.add(o)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(obj)
    return out


if __name__ == "__main__":
    main()
