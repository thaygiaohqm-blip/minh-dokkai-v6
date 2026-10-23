#!/usr/bin/env python3
"""Loại các mục trùng với cấp thấp hơn hoặc trùng trong cùng cấp, rồi báo số mục còn lại.

Chạy:  python3 tools/dedupe.py n2            (chỉ báo cáo)
       python3 tools/dedupe.py n2 --apply    (xóa dòng trùng khỏi file nguồn)
"""
import sys, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source"
ORDER = ["n5", "n4", "n3", "n2", "n1"]
KJ = r"㐀-䶿一-鿿豈-﫿々〆ヶヵ"
RUBY = re.compile(rf"([{KJ}]+)\[([^\]]+)\]")

def key(word):
    w = word.replace(" ", "")
    surf = RUBY.sub(lambda m: m.group(1), w)
    kana = RUBY.sub(lambda m: m.group(2), w)
    return surf, kana

def entries(path):
    for ln, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line[0] in "#@":
            continue
        yield ln, key(line.split(" | ")[0])

def main():
    target = sys.argv[1]
    apply = "--apply" in sys.argv
    earlier = {}
    for lv in ORDER[:ORDER.index(target)]:
        for f in sorted((SRC / lv).glob("*.txt")):
            for ln, k in entries(f):
                earlier.setdefault(k, f"{lv}/{f.stem}")
                earlier.setdefault((k[0], None), f"{lv}/{f.stem}")
    seen = {}
    total = 0
    for f in sorted((SRC / target).glob("*.txt")):
        drop = {}
        for ln, k in entries(f):
            where = earlier.get(k) or (earlier.get((k[0], None)) if len(k[0]) > 1 else None) or seen.get(k)
            if where:
                drop[ln] = f"{k[0]} (đã có ở {where})"
            else:
                seen[k] = f"{target}/{f.stem}"
        lines = f.read_text(encoding="utf-8").splitlines()
        kept = sum(1 for i, l in enumerate(lines, 1) if l.strip() and l.strip()[0] not in "#@" and i not in drop)
        total += kept
        print(f"{f.stem}: còn {kept} mục, trùng {len(drop)}" + (": " + ", ".join(drop.values()) if drop else ""))
        if apply and drop:
            f.write_text("\n".join(l for i, l in enumerate(lines, 1) if i not in drop) + "\n", encoding="utf-8")
    print(f"Tổng {target}: {total}")

if __name__ == "__main__":
    main()
