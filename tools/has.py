#!/usr/bin/env python3
"""In những từ (mặt chữ) CHƯA có trong kho. Dùng: python3 tools/has.py 景気 円高 ..."""
import sys, re, glob
KJ = r"㐀-䶿一-鿿豈-﫿々〆ヶヵ"
R = re.compile(rf"([{KJ}]+)\[([^\]]+)\]")
have = {}
for f in sorted(glob.glob("source/*/*.txt") + glob.glob("source/giaotrinh/_extra/*.txt")):
    if "/nganh/" in f or ("/giaotrinh/" in f and "/_extra/" not in f): continue
    for l in open(f, encoding="utf-8"):
        if l.strip() and l[0] not in "#@":
            have.setdefault(R.sub(lambda m: m.group(1), l.split(" | ")[0]).replace(" ", ""), f.split("/")[-2] + "/" + f.split("/")[-1][:-4])
words = " ".join(sys.argv[1:]).split()
new = [w for w in words if w not in have]
dup = [f"{w}({have[w]})" for w in words if w in have]
print("MỚI", len(new), ":", " ".join(new))
print("ĐÃ CÓ", len(dup), ":", " ".join(dup))
