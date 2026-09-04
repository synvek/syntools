#!/usr/bin/env python3
"""Apply a T: en -> (es, pt) dict to write quality-XX.json and merge caches."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".i18n-cache"
MAPS = CACHE / "maps"


def apply_batch(name: str, T: dict[str, tuple[str, str]], expected: list[str] | None = None) -> None:
    if expected is not None:
        missing = [s for s in expected if s not in T]
        extra = [s for s in T if s not in expected]
        if missing or extra:
            raise SystemExit(f"{name}: missing={len(missing)} extra={len(extra)} sample_missing={missing[:5]}")
    out = {en: {"es": es, "pt": pt} for en, (es, pt) in T.items()}
    path = MAPS / f"{name}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.name} ({len(out)})")


def merge_all() -> None:
    es = json.loads((CACHE / "es.json").read_text(encoding="utf-8"))
    pt = json.loads((CACHE / "pt.json").read_text(encoding="utf-8"))
    for p in sorted(MAPS.glob("quality-*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        for en, tr in data.items():
            es[en] = tr["es"]
            pt[en] = tr["pt"]
    (CACHE / "es.json").write_text(json.dumps(es, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    (CACHE / "pt.json").write_text(json.dumps(pt, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    need = json.loads((CACHE / "need-translate.json").read_text(encoding="utf-8"))
    keep = set(json.loads((CACHE / "keep.json").read_text(encoding="utf-8")))
    miss = [s for s in need if s not in keep and (es.get(s, s) == s or pt.get(s, s) == s)]
    print(f"merged es={len(es)} pt={len(pt)} still_missing_or_identical={len(miss)}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "merge":
        merge_all()
