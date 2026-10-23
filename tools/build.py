#!/usr/bin/env python3
"""Minh Dokkai — biên dịch dữ liệu nguồn (source/<cap>/*.txt) thành data/<cap>.js.

Định dạng một dòng trong file nguồn (phân tách bằng " | "):
  từ | từ loại | âm Hán Việt | nghĩa | cụm từ | nghĩa cụm | câu ví dụ | dịch ví dụ

Quy ước:
  • Kanji kèm cách đọc:   経済[けいざい]   食[た]べる
  • Trong cụm từ, các khối cách nhau bằng dấu cách (để tạo romaji có ngắt từ).
    Dấu cách bị bỏ khi hiển thị tiếng Nhật.
  • Trợ từ は / へ trong cụm từ đứng thành khối riêng sẽ đọc là "wa" / "e".
  • {…} đánh dấu từ chính trong cụm. Nếu bỏ trống, công cụ tự tìm và đánh dấu.
  • Ô không có nội dung ghi "-".
Dòng bắt đầu bằng @ là thông tin chủ đề; dòng bắt đầu bằng # là ghi chú.

Chạy:  python3 tools/build.py          (biên dịch tất cả cấp có dữ liệu)
       python3 tools/build.py --check  (chỉ kiểm tra, in báo cáo)
"""
import hashlib, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source"
OUT = ROOT / "data"

POS = {
    "n": "Danh từ", "pron": "Đại từ", "q": "Từ để hỏi",
    "v1": "Động từ nhóm 1", "v2": "Động từ nhóm 2", "v3": "Động từ nhóm 3",
    "adj-i": "Tính từ đuôi い", "adj-na": "Tính từ đuôi な", "adv": "Phó từ",
    "conj": "Liên từ", "ctr": "Trợ số từ", "num": "Số từ", "exp": "Cụm cố định",
    "interj": "Thán từ", "pref": "Tiếp đầu ngữ", "suf": "Tiếp vĩ ngữ", "part": "Trợ từ",
}
KANJI = r"㐀-䶿一-鿿豈-﫿々〆ヶヵ"
RUBY = re.compile(rf"([{KANJI}]+)\[([^\]]+)\]")
HAS_KANJI = re.compile(rf"[{KANJI}]")
KANA_ONLY = re.compile(r"^[ぁ-ゖァ-ーー・]+$")

# ---------------------------------------------------------------- romaji
def kata2hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)

BASE = {
 "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
 "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
 "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
 "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo",
 "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","ゐ":"i","ゑ":"e","を":"o","ん":"n",
 "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
 "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
 "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ゔ":"vu",
 "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","ゃ":"ya","ゅ":"yu","ょ":"yo","ゎ":"wa",
}
DIGRAPH = {
 "きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho","ちゃ":"cha","ちゅ":"chu","ちょ":"cho",
 "にゃ":"nya","にゅ":"nyu","にょ":"nyo","ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo","みゃ":"mya","みゅ":"myu","みょ":"myo",
 "りゃ":"rya","りゅ":"ryu","りょ":"ryo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo","じゃ":"ja","じゅ":"ju","じょ":"jo",
 "ぢゃ":"ja","ぢゅ":"ju","ぢょ":"jo","びゃ":"bya","びゅ":"byu","びょ":"byo","ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo",
 "ふぁ":"fa","ふぃ":"fi","ふぇ":"fe","ふぉ":"fo","てぃ":"ti","でぃ":"di","とぅ":"tu","どぅ":"du","うぃ":"wi","うぇ":"we",
 "うぉ":"wo","しぇ":"she","じぇ":"je","ちぇ":"che","ゔぁ":"va","ゔぃ":"vi","ゔぇ":"ve","ゔぉ":"vo","てゅ":"tyu","でゅ":"dyu",
 "つぁ":"tsa","つぃ":"tsi","つぇ":"tse","つぉ":"tso","いぇ":"ye","くぁ":"kwa",
}

def kana_romaji(kana):
    s = kata2hira(kana)
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "っ":
            nxt = romaji_at(s, i + 1)[0]
            if nxt:
                out.append("t" if nxt.startswith("ch") else nxt[0])
            i += 1
            continue
        if c == "ー":
            prev = "".join(out)
            out.append(prev[-1] if prev and prev[-1] in "aiueo" else "")
            i += 1
            continue
        if c == "ん":
            nxt = romaji_at(s, i + 1)[0]
            out.append("n'" if nxt and nxt[0] in "aiueoy" else "n")
            i += 1
            continue
        r, step = romaji_at(s, i)
        out.append(r if r is not None else c)
        i += step
    return "".join(out)

def romaji_at(s, i):
    if i >= len(s):
        return "", 1
    if s[i:i + 2] in DIGRAPH:
        return DIGRAPH[s[i:i + 2]], 2
    return BASE.get(s[i]), 1

# ---------------------------------------------------------------- markup
def to_kana(markup):
    return RUBY.sub(lambda m: m.group(2), markup).replace("{", "").replace("}", "")

def surface(markup):
    return RUBY.sub(lambda m: m.group(1), markup).replace("{", "").replace("}", "").replace(" ", "")

def phrase_romaji(markup):
    parts = []
    for tok in to_kana(markup).split():
        if tok == "は":
            parts.append("wa")
        elif tok == "へ":
            parts.append("e")
        else:
            parts.append(kana_romaji(tok))
    return " ".join(parts)

def check_markup(markup, where, problems):
    leftover = RUBY.sub("", markup)
    if HAS_KANJI.search(leftover):
        problems.append(f"{where}: kanji thiếu cách đọc → {markup}")
    for m in RUBY.finditer(markup):
        if not KANA_ONLY.match(m.group(2)):
            problems.append(f"{where}: cách đọc không phải kana → {m.group(0)}")
    if markup.count("[") != markup.count("]"):
        problems.append(f"{where}: ngoặc vuông lệch → {markup}")

# ---------------------------------------------------------------- kakasi cross-check (tùy chọn)
try:
    import pykakasi
    _kks = pykakasi.kakasi()
    def kakasi_reading(text):
        return "".join(x["hira"] for x in _kks.convert(text))
except Exception:  # pragma: no cover
    kakasi_reading = None

def cross_check(markup, where, notes):
    if not kakasi_reading:
        return
    for m in RUBY.finditer(markup):
        kanji, reading = m.group(1), kata2hira(m.group(2))
        if len(kanji) < 2:
            continue
        guess = kakasi_reading(kanji)
        if guess and kata2hira(guess) != reading:
            notes.append(f"{where}: {kanji} — đã ghi 「{reading}」, pykakasi gợi ý 「{guess}」")

# ---------------------------------------------------------------- parse
def parse_topic(path, level, problems, notes):
    meta, entries = {}, []
    for ln, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = unicodedata.normalize("NFC", raw.strip())
        if not line or line.startswith("#"):
            continue
        if line.startswith("@"):
            k, _, v = line[1:].partition(" ")
            meta[k] = v.strip()
            continue
        cols = [c.strip() for c in line.split(" | ")]
        where = f"{path.relative_to(ROOT)}:{ln}"
        if len(cols) != 8:
            problems.append(f"{where}: cần 8 cột, có {len(cols)} → {line[:60]}")
            continue
        w, pos, hv, vi, col, colvi, ex, exvi = [("" if c == "-" else c) for c in cols]
        # Viết tắt: {X} trong cụm từ mà X chưa có cách đọc → thay bằng chính từ chính
        def _expand(m):
            inner = m.group(1)
            if "[" not in inner and HAS_KANJI.search(inner) and inner == surface(w):
                return "{" + w.replace(" ", "") + "}"
            return m.group(0)
        col = re.sub(r"\{([^}]*)\}", _expand, col)
        for p in pos.split(","):
            if p not in POS:
                problems.append(f"{where}: từ loại lạ '{p}'")
        for fld in (w, col, ex):
            if fld:
                check_markup(fld.replace(" ", ""), where, problems)
                cross_check(fld, where, notes)
        if HAS_KANJI.search(surface(w)) and not hv:
            problems.append(f"{where}: thiếu âm Hán Việt cho {surface(w)}")
        if col and not colvi:
            problems.append(f"{where}: cụm từ thiếu nghĩa")
        if not ex or not exvi:
            problems.append(f"{where}: thiếu câu ví dụ hoặc bản dịch")
        if col and "{" not in col:
            wm = w.replace(" ", "")
            idx = col.find(wm)
            if idx >= 0:
                col = col[:idx] + "{" + wm + "}" + col[idx + len(wm):]
        entries.append({
            "w": w, "r": to_kana(w).replace(" ", ""), "rm": phrase_romaji(w),
            "p": pos, "hv": hv, "vi": vi,
            "c": col, "cr": phrase_romaji(col) if col else "", "cv": colvi,
            "e": ex, "ev": exvi,
        })
    tid = meta.get("topic") or path.stem
    for i, e in enumerate(entries, 1):
        e["id"] = f"{level}-{tid}-{i:03d}"
    return {"id": tid, "ja": meta.get("ja", ""), "vi": meta.get("vi", ""),
            "desc": meta.get("desc", ""), "items": entries}

ORDER = ["n5", "n4", "n3", "n2", "n1", "nganh"]

def build_books(gt_dir, index, problems, notes):
    """Đọc source/giaotrinh/*.txt.
    @book id · @name tên · @short tên ngắn · @desc mô tả
    @unit số | cấp | tiêu đề | tiêu đề tiếng Việt
    Mỗi dòng sau đó là một mục theo đúng thứ tự giáo trình:
      • chỉ ghi từ (có thể kèm số thứ tự đầu dòng): 友人[ゆうじん]  → tìm trong kho
      • hoặc đủ 8 cột như file chủ đề → mục mới, chỉ dùng trong giáo trình
    """
    by_surf, by_read = {}, {}
    id_surf = {i: k[0] for k, i in index.items()}
    for (s, r), i in index.items():
        by_surf.setdefault(s, []).append(i)
        by_read.setdefault(r, []).append(i)
    books, extras, missing = [], [], []
    # Kho mục riêng của giáo trình: source/giaotrinh/_extra/*.txt (8 cột, như file chủ đề).
    # Từ nào trong danh sách giáo trình không có trong kho JLPT sẽ lấy ở đây.
    pool, pool_surf = {}, {}
    xdir = gt_dir / "_extra"
    if xdir.is_dir():
        for xf in sorted(xdir.glob("*.txt")):
            for e in parse_topic(xf, "gt", problems, notes)["items"]:
                k = (surface(e["w"]), e["r"])
                if k in index:
                    problems.append(f"{xf.name}: {k[0]} đã có trong kho JLPT, bỏ khỏi _extra"); continue
                pool[k] = e; pool_surf.setdefault(k[0], []).append(k)
    used = {}
    BOOK_ORDER = ["minna", "mimi-n3", "mimi-n2", "mimi-n1"]  # sách dễ trước: mục dùng chung lấy cấp thấp nhất
    for f in sorted(gt_dir.glob("*.txt"), key=lambda x: (BOOK_ORDER.index(x.stem) if x.stem in BOOK_ORDER else 99, x.stem)):
        meta, units, cur = {}, [], None
        new_items, miss = [], []
        for ln, raw in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            line = unicodedata.normalize("NFC", raw.strip())
            if not line or line.startswith("#"):
                continue
            if line.startswith("@unit"):
                parts = [p.strip() for p in line[5:].split("|")]
                cur = {"n": parts[0], "lv": parts[1], "title": parts[2] if len(parts) > 2 else "", "vi": parts[3] if len(parts) > 3 else "", "ids": []}
                units.append(cur)
                continue
            if line.startswith("@"):
                k, _, v = line[1:].partition(" ")
                meta[k] = v.strip()
                continue
            where = f"{f.relative_to(ROOT)}:{ln}"
            if cur is None:
                problems.append(f"{where}: mục nằm ngoài @unit"); continue
            line = re.sub(r"^\d+\s*[.|]?\s*", "", line)
            cols = [c.strip() for c in line.split(" | ")]
            if len(cols) == 8:
                tmp = Path("/tmp/_gt_one.txt")
                tmp.write_text(line + "\n", encoding="utf-8")
                t = parse_topic(tmp, "gt", problems, notes)
                if not t["items"]:
                    continue
                e = t["items"][0]
                key = (surface(e["w"]), e["r"])
                if key in index:
                    cur["ids"].append(index[key]); continue
                e["id"] = f"gt-{meta.get('book', f.stem)}-{len(new_items) + 1:04d}"
                e["lv"] = cur["lv"]
                new_items.append(e); cur["ids"].append(e["id"])
                index[key] = e["id"]; by_surf.setdefault(key[0], []).append(e["id"]); by_read.setdefault(key[1], []).append(e["id"])
                continue
            w = cols[0].replace(" ", "")
            check_markup(w, where, problems)
            s, r = surface(w), to_kana(w)
            hit = index.get((s, r))
            if not hit and len(by_surf.get(s, [])) == 1:
                hit = by_surf[s][0]
            if not hit and s == r and len(by_read.get(r, [])) >= 1:
                hit = by_read[r][0]
            if not hit:  # 結婚 ~ 結婚する, お祭り ~ 祭り, ほしい ~ 欲しい
                for s2, r2 in ((s + "する", r + "する"), (s[:-2], r[:-2]) if s.endswith("する") and len(s) > 3 else ("", ""), (s[1:], r[1:]) if s[:1] in "おご" and len(s) > 2 else ("", ""), (s[:-1], r[:-1]) if s[-1:] in "にと" and len(s) > 2 else ("", "")):
                    if s2 and (s2, r2) in index:
                        hit = index[(s2, r2)]; break
                if not hit:
                    kc = [i for i in by_read.get(r, []) if id_surf.get(i, "") == r or s == r]
                    if len(kc) == 1:
                        hit = kc[0]
            if not hit:  # 気付く ~ 気づく: cùng cách đọc, cùng chữ đầu
                cands = [i for i in by_read.get(r, []) if id_surf.get(i, '')[:1] == s[:1]] if r else []
                if len(cands) == 1:
                    hit = cands[0]
            if not hit:
                pk = (s, r) if (s, r) in pool else (pool_surf[s][0] if len(pool_surf.get(s, [])) == 1 else None)
                if pk:
                    if pk not in used:
                        e = dict(pool[pk]); e["id"] = "gt-" + hashlib.sha1((pk[0] + "|" + pk[1]).encode()).hexdigest()[:10]; e["lv"] = cur["lv"]
                        used[pk] = e["id"]; new_items.append(e)
                    hit = used[pk]
            if hit:
                cur["ids"].append(hit)
            else:
                miss.append(f"{meta.get('book', f.stem)} · {cur['n']} · {w}")
        bid = meta.get("book", f.stem)
        if new_items:
            extras.append({"id": bid, "ja": "", "vi": meta.get("name", bid), "desc": "", "items": new_items})
        books.append({"id": bid, "name": meta.get("name", bid), "short": meta.get("short", bid),
                      "desc": meta.get("desc", ""), "units": units, "_new": new_items, "_miss": miss})
        missing.extend(miss)
    return books, extras, missing


def build(check_only=False):
    problems, notes, summary = [], [], []
    OUT.mkdir(exist_ok=True)
    earlier = {}  # (mặt chữ, cách đọc) -> id ở cấp thấp hơn
    dirs = [SRC / d for d in ORDER if (SRC / d).is_dir()]
    for lvdir in dirs:
        level = lvdir.name
        topics = [parse_topic(f, level, problems, notes) for f in sorted(lvdir.glob("*.txt"))]
        seen = {}
        for t in topics:
            local = {}
            for e in t["items"]:
                key = (surface(e["w"]), e["r"])
                if level == "nganh":
                    if key in local:
                        problems.append(f"{level}/{t['id']}: trùng mục {key[0]} ({local[key]} và {e['id']})")
                    local[key] = e["id"]
                    continue
                if key in seen:
                    problems.append(f"{level}: trùng mục {key[0]} ({seen[key]} và {e['id']})")
                if key in earlier:
                    problems.append(f"{level}: {key[0]} đã có ở {earlier[key]} ({e['id']})")
                seen[key] = e["id"]
        if level != "nganh":
            earlier.update(seen)
        total = sum(len(t["items"]) for t in topics)
        summary.append(f"{level}: {len(topics)} chủ đề, {total} mục " +
                       ", ".join(f"{t['id']}={len(t['items'])}" for t in topics))
        if not check_only:
            payload = json.dumps({"level": level, "topics": topics}, ensure_ascii=False, separators=(",", ":"))
            (OUT / f"{level}.js").write_text(f"MD.register({payload});\n", encoding="utf-8")
    # ---------------------------------------------------------------- giáo trình
    gt_dir = SRC / "giaotrinh"
    if gt_dir.is_dir():
        books, extras, gt_missing = build_books(gt_dir, earlier, problems, notes)
        for b in books:
            n = sum(len(u["ids"]) for u in b["units"])
            summary.append(f"giáo trình {b['id']}: {len(b['units'])} bài, {n} mục, {len(b['_new'])} mục mới, {len(b['_miss'])} chưa có")
        (ROOT / "tools" / "giaotrinh-thieu.txt").write_text("\n".join(gt_missing) + "\n", encoding="utf-8")
        if not check_only:
            for b in books:
                b.pop("_new"); b.pop("_miss")
            payload = json.dumps({"books": books}, ensure_ascii=False, separators=(",", ":"))
            extra = json.dumps({"level": "gt", "topics": extras}, ensure_ascii=False, separators=(",", ":"))
            (OUT / "giaotrinh.js").write_text(f"MD.registerBooks({payload});\nMD.register({extra});\n", encoding="utf-8")
    (ROOT / "tools" / "report.txt").write_text(
        "LỖI\n" + "\n".join(problems or ["(không có)"]) +
        "\n\nCẦN XEM LẠI CÁCH ĐỌC (gợi ý máy, có thể sai)\n" + "\n".join(notes or ["(không có)"]) + "\n",
        encoding="utf-8")
    print("\n".join(summary))
    print(f"Lỗi: {len(problems)} · Gợi ý cần xem: {len(notes)} (chi tiết: tools/report.txt)")
    for p in problems[:60]:
        print("  ✗", p)
    return not problems

if __name__ == "__main__":
    sys.exit(0 if build("--check" in sys.argv) else 1)
