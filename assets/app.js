/* Minh Dokkai — ứng dụng một trang, không cần build. Dữ liệu nằm trong data/*.js */
(() => {
  "use strict";
  const C = window.MD_CATALOG;
  const main = document.getElementById("main");
  const LV = {};          // dữ liệu từng cấp đã tải
  const waiting = {};

  /* ------------------------------------------------------------ dữ liệu */
  window.MD = {
    register(d) {
      d.topics.forEach(t => t.items.forEach(e => { e.lv = e.lv || d.level; e.t = t.id; }));
      LV[d.level] = d;
      (waiting[d.level] || []).forEach(f => f.ok(d));
      delete waiting[d.level];
    },
    registerBooks(d) {   // data/giaotrinh.js: thứ tự từ theo giáo trình
      LV.giaotrinh = d;
      (waiting.giaotrinh || []).forEach(f => f.ok(d));
      delete waiting.giaotrinh;
    }
  };
  function load(lv) {
    if (LV[lv]) return Promise.resolve(LV[lv]);
    return new Promise((ok, no) => {
      const first = !waiting[lv];
      (waiting[lv] = waiting[lv] || []).push({ ok, no });
      if (!first) return;
      const s = document.createElement("script");
      s.src = `data/${lv}.js`;
      s.onerror = () => { (waiting[lv] || []).forEach(f => f.no(new Error(lv))); delete waiting[lv]; };
      document.head.appendChild(s);
    });
  }
  const readyLevels = () => C.levels.filter(l => l.ready).map(l => l.id);
  const loadAll = () => Promise.all(readyLevels().map(load));
  const allItems = () => readyLevels().flatMap(lv => LV[lv] ? LV[lv].topics.flatMap(t => t.items) : []);
  const levelOf = id => C.levels.find(l => l.id === id);

  /* ------------------------------------------------------------ lưu trữ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("md:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("md:" + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  };
  const S = Object.assign({ kanji: true, romaji: true, furi: true, quizDir: "jv" }, store.get("settings", {}));
  const P = Object.assign({ ok: {}, rv: {}, gt: {}, clr: 0 }, store.get("progress", {}));
  const saveS = () => store.set("settings", S);
  // Mọi thay đổi tiến độ đều báo cho module tài khoản (assets/auth.js) để đồng bộ khi đã đăng nhập.
  const listeners = [];
  const notify = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const saveP = () => { store.set("progress", P); paintReviewBadge(); notify(); };
  const nowSec = () => Math.floor(Date.now() / 1000);   // dấu thời gian (giây) để gộp tiến độ giữa các thiết bị
  function mark(id, st) {
    if (st === "ok") { P.ok[id] = nowSec(); delete P.rv[id]; }
    if (st === "rv") { P.rv[id] = nowSec(); delete P.ok[id]; }
    saveP();
  }
  const stateOf = id => P.rv[id] ? "rv" : P.ok[id] ? "ok" : "";

  /* ------------------------------------------------------------ tiếng Nhật */
  const KJ = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff々〆ヶヵ";
  const TOK = new RegExp(`(\\{)|(\\})|([${KJ}]+)\\[([^\\]]+)\\]|( )|([^{}])`, "g");
  const RUBY = new RegExp(`([${KJ}]+)\\[([^\\]]+)\\]`, "g");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function jp(m, o = {}) {
    if (!m) return "";
    const kanji = o.kanji ?? S.kanji;
    let out = "", hidden = false;
    for (const x of m.matchAll(TOK)) {
      if (x[1]) { if (o.blank) { hidden = true; out += '<span class="blank" aria-label="chỗ trống">＿</span>'; } else if (o.hl !== false) out += '<mark class="hw">'; continue; }
      if (x[2]) { if (hidden) hidden = false; else if (!o.blank && o.hl !== false) out += "</mark>"; continue; }
      if (hidden) continue;
      if (x[3]) out += kanji ? ((o.furi ?? S.furi) ? `<ruby>${x[3]}<rt>${x[4]}</rt></ruby>` : x[3]) : x[4];
      else if (x[5]) out += kanji ? "" : '<span class="sp"></span>';
      else out += esc(x[6]);
    }
    return out;
  }
  const kana = m => (m || "").replace(RUBY, "$2").replace(/[{} ]/g, "");
  const surf = m => (m || "").replace(RUBY, "$1").replace(/[{} ]/g, "");
  const hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  const BASE = { あ:"a",い:"i",う:"u",え:"e",お:"o",か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",や:"ya",ゆ:"yu",よ:"yo",ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",わ:"wa",を:"o",ん:"n",が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",ゔ:"vu",ぁ:"a",ぃ:"i",ぅ:"u",ぇ:"e",ぉ:"o",ゃ:"ya",ゅ:"yu",ょ:"yo" };
  const DI = { きゃ:"kya",きゅ:"kyu",きょ:"kyo",しゃ:"sha",しゅ:"shu",しょ:"sho",ちゃ:"cha",ちゅ:"chu",ちょ:"cho",にゃ:"nya",にゅ:"nyu",にょ:"nyo",ひゃ:"hya",ひゅ:"hyu",ひょ:"hyo",みゃ:"mya",みゅ:"myu",みょ:"myo",りゃ:"rya",りゅ:"ryu",りょ:"ryo",ぎゃ:"gya",ぎゅ:"gyu",ぎょ:"gyo",じゃ:"ja",じゅ:"ju",じょ:"jo",びゃ:"bya",びゅ:"byu",びょ:"byo",ぴゃ:"pya",ぴゅ:"pyu",ぴょ:"pyo",ふぁ:"fa",ふぃ:"fi",ふぇ:"fe",ふぉ:"fo",てぃ:"ti",でぃ:"di",うぃ:"wi",うぇ:"we",しぇ:"she",じぇ:"je",ちぇ:"che" };
  function romaji(k) {
    const s = hira(k); let out = "";
    const at = i => DI[s.substr(i, 2)] || BASE[s[i]] || "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "っ") { const n = at(i + 1); out += n.startsWith("ch") ? "t" : (n[0] || ""); continue; }
      if (c === "ー") { const v = out.slice(-1); out += "aiueo".includes(v) ? v : ""; continue; }
      if (DI[s.substr(i, 2)]) { out += DI[s.substr(i, 2)]; i++; continue; }
      out += BASE[c] ?? c;
    }
    return out;
  }
  const norm = s => (s || "").trim().toLowerCase().replace(/[\s・。、.,'’\-]/g, "");
  const loose = r => r.replace(/n'/g, "n").replace(/ou/g, "o").replace(/oo/g, "o").replace(/uu/g, "u").replace(/aa/g, "a").replace(/ii/g, "i").replace(/ee/g, "e").replace(/ei/g, "e");
  function checkAnswer(input, e) {
    const a = norm(input);
    if (!a) return false;
    const forms = [surf(e.w), kana(e.w)];
    if (/^v3/.test(e.p) || /する$/.test(kana(e.w))) forms.push(...forms.map(f => f.replace(/する$/, "")));
    if (forms.some(f => f && (hira(norm(f)) === hira(a)))) return true;
    const ra = /^[a-z']+$/.test(a) ? a : romaji(a);
    const targets = [e.rm.replace(/\s/g, ""), e.rm.replace(/\s?suru$/, "").replace(/\s/g, "")];
    return targets.some(t => loose(ra) === loose(t));
  }

  /* ------------------------------------------------------------ giọng đọc */
  let jaVoice = null, voicesChecked = false;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    if (vs.length) voicesChecked = true;
    jaVoice = vs.find(v => /^ja[-_]JP/i.test(v.lang) && /google|kyoko|o-ren|nanami|haruka/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!("speechSynthesis" in window)) return toast("Trình duyệt này chưa hỗ trợ đọc thành tiếng.");
    if (voicesChecked && !jaVoice) toast("Thiết bị chưa có giọng đọc tiếng Nhật. Hãy cài thêm giọng Nhật trong phần cài đặt ngôn ngữ.");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; if (jaVoice) u.voice = jaVoice; u.rate = 0.88;
    speechSynthesis.speak(u);
  }
  const ICON_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const ICON_FLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>';

  /* ------------------------------------------------------------ hiệu ứng đúng / sai */
  const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function celebrate(el, big) {
    if (!el) return;
    el.animate([{ transform: "scale(1)" }, { transform: "scale(1.045)" }, { transform: "scale(1)" }], { duration: 380, easing: "cubic-bezier(.3,1.6,.5,1)" });
    if (calm()) return;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(document.documentElement);
    const cols = ["--mint", "--coral", "--green", "--mint"].map(v => cs.getPropertyValue(v).trim() || "#27c4b5");
    const n = big ? 46 : 16, x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i");
      d.className = "confetto";
      d.style.cssText = `left:${x0}px;top:${y0}px;background:${cols[i % cols.length]};${i % 3 ? "" : "border-radius:50%;"}`;
      document.body.appendChild(d);
      const ang = Math.random() * Math.PI * 2, dist = (big ? 140 : 70) + Math.random() * (big ? 160 : 60);
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * .7 - (big ? 60 : 30);
      d.animate([
        { transform: "translate(-50%,-50%) rotate(0) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540 - 270}deg) scale(.9)`, opacity: 1, offset: .6 },
        { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 70}px)) rotate(${Math.random() * 720}deg) scale(.6)`, opacity: 0 }
      ], { duration: 750 + Math.random() * 450, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => d.remove();
    }
  }
  function wobble(el) {
    if (!el) return;
    if (calm()) { el.animate([{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }], { duration: 300 }); return; }
    el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 420, easing: "ease-out" });
  }
  function verdict(el, ok) {
    if (!el) return;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }
  function glow(el, ok) {
    if (!el || calm()) return;
    const c = getComputedStyle(document.documentElement).getPropertyValue(ok ? "--mint" : "--coral").trim();
    el.animate(ok ? [{ boxShadow: `0 0 0 0 ${c}99` }, { boxShadow: `0 0 0 16px ${c}00` }]
                  : [{ boxShadow: `inset 0 0 0 2px ${c}` }, { boxShadow: `inset 0 0 0 0 ${c}00` }], { duration: ok ? 700 : 600, easing: "ease-out" });
  }
  const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(45); } catch (e) { /* bỏ qua */ } };
  const PRAISE = [["Chính xác!", "正解"], ["Tuyệt vời!", "すごい"], ["Giỏi lắm!", "いいね"], ["Chuẩn rồi!", "完璧"], ["Đúng rồi!", "その通り"]];
  const OOPS = [["Chưa đúng", "惜しい"], ["Suýt nữa rồi", "もう少し"], ["Chưa chính xác", "残念"]];
  const pickWord = ok => { const l = ok ? PRAISE : OOPS; return l[Math.floor(Math.random() * l.length)]; };
  const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_NO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>';
  function verdictHTML(ok, word, ans, streak) {
    const [vi, ja] = word || (ok ? PRAISE[0] : OOPS[0]);
    return `<span class="verdict verdict--${ok ? "ok" : "no"}"><span class="verdict__icon">${ok ? ICON_OK : ICON_NO}</span>
      <span class="verdict__word">${vi}<span class="verdict__ja" lang="ja">${ja}${ok ? "！" : "…"}</span></span>${ok && streak >= 3 ? `<span class="streak">${streak} câu đúng liên tiếp</span>` : ""}</span>${ans ? `<div class="verdict__ans">${ans}</div>` : ""}`;
  }
  function scoreRing(right, total) {
    const c = 2 * Math.PI * 52, pct = total ? right / total : 0;
    return `<svg class="score-ring" viewBox="0 0 120 120" role="img" aria-label="Đúng ${Math.round(pct * 100)} phần trăm"><circle class="bg" cx="60" cy="60" r="52"/>
      <circle class="fg" cx="60" cy="60" r="52" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-off="${(c * (1 - pct)).toFixed(1)}"/>
      <text x="60" y="69" text-anchor="middle">${Math.round(pct * 100)}%</text></svg>`;
  }
  function doneHTML(title, right, total, note, buttons) {
    const pct = total ? right / total : 0;
    const msg = pct >= .9 ? "Xuất sắc! Bạn nắm rất chắc gói này." : pct >= .7 ? "Rất tốt. Ôn lại vài từ sai là trọn vẹn." : pct >= .5 ? "Khá ổn. Hãy luyện lại các câu sai nhé." : "Cần ôn thêm. Thử học thẻ trước rồi quay lại.";
    return `<div class="card"><div class="done">${scoreRing(right, total)}<h3>${title}</h3><p class="done__msg">${msg}</p><p>${note}</p>
      <div class="hero__actions">${buttons}</div></div></div>`;
  }
  function afterDone(root, right, total) {
    const fg = root.querySelector(".score-ring .fg");
    if (fg) requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = fg.dataset.off; }));
    if (total && right / total >= .7) setTimeout(() => celebrate(root.querySelector(".score-ring"), true), 650);
  }

  /* ------------------------------------------------------------ tiện ích */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => n.toLocaleString("vi-VN");
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const posName = p => p.split(",").map(x => C.posName[x] || x).join(", ");
  const meaningOf = e => e.c ? e.cv : e.vi;
  let toastTimer;
  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function paintReviewBadge() {
    const n = Object.keys(P.rv).length;
    $$("[data-review-count]").forEach(b => { b.hidden = !n; b.textContent = n; });
  }
  const learnedIn = items => items.reduce((s, e) => s + (P.ok[e.id] ? 1 : 0), 0);
  const meter = (a, b) => `<div class="meter" role="img" aria-label="Đã học ${a} trên ${b}"><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></div>`;
  const lvtag = lv => lv === "nganh" ? `<span class="lvtag" data-lv="nganh">Ngành</span>` : `<span class="lvtag" data-lv="${lv}">${lv.toUpperCase()}</span>`;
  function band({ crumb, crumbHref, big, bigJp, title, text, meta, extra, compact }) {
    return `<section class="band${compact ? " band--compact" : ""}"><div class="wrap band__in">
      <div class="band__big${bigJp ? " jp" : ""}" ${bigJp ? 'lang="ja"' : ""}>${big}</div>
      <div>${crumb ? `<a class="crumb" href="${crumbHref}"><span aria-hidden="true">←</span> ${esc(crumb)}</a>` : ""}
        <h1>${title}</h1>${text ? `<p>${text}</p>` : ""}${extra || ""}</div>
      ${meta ? `<div class="band__meta">${meta}</div>` : ""}
    </div></section>`;
  }

  /* ------------------------------------------------------------ điều hướng */
  let current = null;   // màn học đang mở
  function setNav(key) {
    $$("[data-nav]").forEach(a => { if (a.dataset.nav === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }
  async function route() {
    if (current && current.destroy) current.destroy();
    current = null;
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean);
    const q = new URLSearchParams(qs || "");
    window.scrollTo(0, 0);
    try {
      if (!parts.length || parts[0] === "top") { setNav("jlpt"); return await home(); }
      if (/^n[1-5]$/.test(parts[0])) { setNav("jlpt"); return parts[1] ? await topicStudy(parts[0], parts[1]) : await level(parts[0]); }
      if (parts[0] === "tu-loai") { setNav("pos"); return parts[1] ? (parts[2] === "hoc" ? await posStudy(parts[1], q) : await posDetail(parts[1], q)) : await posList(); }
      if (parts[0] === "nganh") { setNav("ind"); return parts[1] ? await industry(parts[1]) : await industries(); }
      if (parts[0] === "giao-trinh") { setNav("gt"); return parts[2] === "on-tap" ? await bookReview(parts[1], "mix") : parts[2] === "can-on" ? await bookReview(parts[1], "rv") : parts[2] ? await bookUnit(parts[1], decodeURIComponent(parts[2])) : parts[1] ? await book(parts[1]) : await books(); }
      if (parts[0] === "on-tap") { setNav("rev"); return parts[1] === "hoc" ? await reviewStudy() : await review(); }
      if (parts[0] === "test") { setNav("test"); return await placement(); }
      notFound();
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="wrap sec"><div class="empty"><h3>Không tải được dữ liệu</h3><p>Hãy mở trang qua một máy chủ web (ví dụ Vercel) hoặc kiểm tra thư mục data/ có đủ file.</p><a class="btn btn--primary" href="#/">Về trang chủ</a></div></div>`;
    }
  }
  function notFound() {
    setNav("");
    main.innerHTML = `<div class="wrap sec"><div class="empty"><h3>Không có trang này</h3><p>Đường dẫn có thể đã thay đổi. Hãy chọn lại cấp độ để tiếp tục học.</p><a class="btn btn--primary" href="#/">Chọn cấp độ</a></div></div>`;
  }

  /* ------------------------------------------------------------ trang chủ */
  async function home() {
    await loadAll();
    const steps = C.levels.map(l => {
      const items = LV[l.id] ? LV[l.id].topics.flatMap(t => t.items) : [];
      const st = l.ready ? (items.length ? `Đã học ${fmt(learnedIn(items))}/${fmt(items.length)}` : "Sẵn sàng") : "Đang biên soạn";
      return `<a class="step" data-lv="${l.id}" href="#/${l.id}">
        <span class="step__lv">${l.name}</span><span class="step__n">${fmt(l.target)} mục từ</span>
        <span class="step__st">${st}</span><span class="step__ja" aria-hidden="true">${"五四三二一"[5 - +l.id[1]]}</span></a>`;
    }).join("");
    const pool = allItems().filter(e => e.c && /[一-龯]/.test(e.c));
    const demoItem = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    main.innerHTML = `
    <section class="hero"><div class="wrap hero__in">
      <div class="hero__copy">
        <h1><span class="jp" lang="ja">${jp("語彙[ごい]は、組[く]み合[あ]わせで覚[おぼ]える。", { hl: false })}</span>Nhớ từ tiếng Nhật bằng cụm từ người Nhật thật sự nói.</h1>
        <p>${fmt(C.total)} mục từ chia theo năm cấp JLPT, mỗi cấp tách thành từng chủ đề. Mỗi từ đi kèm cụm kết hợp thông dụng nhất, âm Hán Việt, romaji và một câu ví dụ.</p>
        <div class="hero__actions"><a class="btn btn--primary" href="#/test">Test trình độ đầu vào</a><a class="btn btn--ghost" href="#/n5">Bắt đầu với N5</a></div>
        ${placeChip()}
        <div class="quick" role="group" aria-label="Chọn cách học">
          <a class="qk" href="#/giao-trinh"><span class="qk__ja" lang="ja" aria-hidden="true">課</span><span class="qk__t"><b>Học theo giáo trình</b><small>Minna no Nihongo · Mimikara Oboeru</small></span></a>
          <a class="qk" href="#/nganh"><span class="qk__ja" lang="ja" aria-hidden="true">職</span><span class="qk__t"><b>Học từ chuyên ngành</b><small>10 ngành thực tập sinh</small></span></a>
          <a class="qk" href="#/tu-loai"><span class="qk__ja" lang="ja" aria-hidden="true">品</span><span class="qk__t"><b>Học theo từ loại</b><small>Động từ, tính từ, phó từ…</small></span></a>
          <a class="qk" href="#/on-tap"><span class="qk__ja" lang="ja" aria-hidden="true">復</span><span class="qk__t"><b>Ôn từ chưa thuộc</b><small>${Object.keys(P.rv).length ? `${fmt(Object.keys(P.rv).length)} từ đang chờ ôn` : "Từ sai tự vào danh sách này"}</small></span></a>
        </div>
      </div>
      <nav class="stairs" aria-label="Chọn cấp độ JLPT">${steps}</nav>
    </div></section>
    ${demoItem ? `<section class="sec"><div class="wrap demo">
      <div id="demo-card"></div>
      <div><h2>Một thẻ, đủ để dùng được từ.</h2>
        <ul class="demo__notes">
          <li><b>Cụm từ đứng trước, từ đơn đứng sau</b><span>Thẻ hiện cách kết hợp phổ biến nhất của từ. Từ quá cơ bản thì chỉ hiện từ.</span></li>
          <li><b>Bật tắt Kanji ở góc trên</b><span>Tắt để luyện bằng hiragana. Bật để thấy Kanji kèm furigana và âm Hán Việt. Nút <b>ふり</b> cho phép ẩn furigana, chỉ hiện chữ Hán.</span></li>
          <li><b>Bốn cách luyện cho mỗi gói</b><span>Học thẻ, trắc nghiệm, viết lại và ghép cặp. Từ trả lời sai tự vào danh sách cần ôn.</span></li>
        </ul></div>
    </div></section>` : ""}
    <section class="sec"><div class="wrap">
      <div class="sec__head"><h2>Bốn cách để học</h2><p class="sec__lead">Cùng một kho từ, nhìn từ bốn hướng. Nhãn cấp độ JLPT luôn đi theo từng từ dù bạn học theo cách nào.</p></div>
      <div class="ways">
        <a class="way" href="#/n5"><span class="way__ja" lang="ja">級別</span><b>Theo cấp độ JLPT</b><span>Từ N5 đến N1, mỗi cấp chia thành các gói chủ đề như gia đình, công việc, kinh tế.</span><em>Chọn cấp độ</em></a>
        <a class="way" href="#/tu-loai"><span class="way__ja" lang="ja">品詞別</span><b>Theo từ loại</b><span>Gom toàn bộ phó từ, động từ, tính từ… qua mọi cấp, có nhãn N5–N1 cạnh từng từ.</span><em>Chọn từ loại</em></a>
        <a class="way" href="#/giao-trinh"><span class="way__ja" lang="ja">教科書別</span><b>Theo giáo trình</b><span>Minna no Nihongo theo bài 1–50, Mimikara Oboeru N3–N1 theo Unit. Học đúng thứ tự sách bạn đang dùng.</span><em>Chọn giáo trình</em></a>
        <a class="way" href="#/nganh"><span class="way__ja" lang="ja">職種別</span><b>Theo chuyên ngành</b><span>Mười gói từ vựng cho các ngành thực tập sinh làm nhiều nhất tại Nhật.</span><em>Xem các ngành</em></a>
      </div>
    </div></section>`;
    if (demoItem) {
      const host = $("#demo-card");
      const paint = () => { host.innerHTML = cardFrontHTML(demoItem, 0, 1, true); bindSpeak(host); };
      paint();
      current = { refresh: paint };
    }
  }

  /* ------------------------------------------------------------ test trình độ đầu vào */
  /* 5 phần N5→N1, mỗi phần 8 câu (tối đa 40 câu, 15 phút). Phần nào đúng dưới 50% thì dừng sớm.
     Đúng từ 75% là "vững" cấp đó. Câu hỏi lấy ngẫu nhiên từ kho từ vựng, không hiện đúng/sai giữa chừng. */
  const PL = { lvs: ["n5", "n4", "n3", "n2", "n1"], per: 8, pass: .75, stop: .5, limit: 15 * 60 };
  const PL_KIND = { mean: "Nghĩa của từ", cloze: "Điền từ vào cụm", read: "Cách đọc Kanji" };
  const HAS_KANJI = new RegExp(`[${KJ}]`);
  const plOK = e => !/(^|,)(pref|suf|ctr)(,|$)/.test(e.p) && !/[~〜～]/.test(e.w) && e.vi;
  const fmtDate = t => new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const lvName = lv => lv.toUpperCase();

  function placeChip() {
    const r = store.get("placement", null);
    if (!r) return "";
    return `<p class="chip-line">Kết quả test gần nhất (${fmtDate(r.at)}): <b>${r.start === "done" ? "Rất vững" : "nên học từ " + lvName(r.start)}</b> · <a href="#/test">xem lại hoặc làm lại</a></p>`;
  }

  function plQuestion(pool, e, kind) {
    const sameP = x => x !== e && x.p[0] === e.p[0];
    const near = list => [...shuffle(list.filter(sameP)), ...shuffle(list.filter(x => x !== e && !sameP(x)))];
    if (kind === "mean") {
      const picks = [];
      for (const x of near(pool)) { if (picks.length === 3) break; if (x.vi !== e.vi && !picks.some(p => p.vi === x.vi)) picks.push(x); }
      if (picks.length < 3) return null;
      const opts = shuffle([e, ...picks]);
      return { kind, e, opts: opts.map(o => o.vi), ans: opts.indexOf(e) };
    }
    if (kind === "cloze") {
      if (!(e.c && e.c.includes("{") && e.cv)) return null;
      const picks = [];
      for (const x of near(pool)) { if (picks.length === 3) break; if (surf(x.w) !== surf(e.w) && x.vi !== e.vi && !picks.some(p => surf(p.w) === surf(x.w))) picks.push(x); }
      if (picks.length < 3) return null;
      const opts = shuffle([e, ...picks]);
      return { kind, e, opts, ans: opts.indexOf(e) };
    }
    if (kind === "read") {
      const rd = kana(e.w);
      if (!HAS_KANJI.test(surf(e.w)) || rd.length < 2) return null;
      const withK = pool.filter(x => HAS_KANJI.test(surf(x.w)) && kana(x.w) !== rd);
      const pickBy = tol => {
        const out = [];
        for (const x of near(withK)) { const k = kana(x.w); if (Math.abs(k.length - rd.length) <= tol && !out.includes(k)) out.push(k); if (out.length === 3) break; }
        return out;
      };
      let picks = pickBy(0); if (picks.length < 3) picks = pickBy(1); if (picks.length < 3) return null;
      const opts = shuffle([rd, ...picks]);
      return { kind, e, opts, ans: opts.indexOf(rd) };
    }
    return null;
  }
  function plBuild() {
    return PL.lvs.map(lv => {
      const pool = LV[lv].topics.flatMap(t => t.items).filter(plOK), used = new Set(), qs = [];
      const pick = kind => {
        for (const e of shuffle(pool)) {
          if (used.has(e.id)) continue;
          const q = plQuestion(pool, e, kind);
          if (q) { used.add(e.id); return q; }
        }
        return null;
      };
      for (const k of ["mean", "mean", "mean", "mean", "cloze", "cloze", "read", "read"]) qs.push(pick(k) || pick("mean"));
      return { lv, qs: shuffle(qs.filter(Boolean)) };
    });
  }
  function plVerdict(stages, timedOut) {
    const per = stages.map(s => {
      const done = s.qs.filter(q => q.pick != null).length;
      const right = s.qs.filter(q => q.pick === q.ans).length;
      return { lv: s.lv, done, right, total: s.qs.length, pct: s.qs.length ? right / s.qs.length : 0 };
    }).filter(p => p.done > 0);
    const state = p => p.pct >= PL.pass ? "vung" : p.pct >= PL.stop ? "dang" : "chua";
    let solid = -1;
    for (let i = 0; i < PL.lvs.length; i++) { const p = per.find(x => x.lv === PL.lvs[i]); if (p && state(p) === "vung") solid = i; else break; }
    const start = solid >= PL.lvs.length - 1 ? "done" : PL.lvs[solid + 1];
    return { per, state, solid: solid < 0 ? null : PL.lvs[solid], start, timedOut };
  }

  async function placement() {
    await loadAll();
    const last = store.get("placement", null);
    const ST = { stages: null, s: 0, k: 0, t0: 0, timer: null, finished: false, dead: false };
    const stopTimer = () => { clearInterval(ST.timer); ST.timer = null; };
    const intro = () => {
      stopTimer();
      main.innerHTML = band({ big: "試", bigJp: true, title: "Test trình độ đầu vào", compact: false,
        text: "Làm một bài kiểm tra ngắn để biết nên bắt đầu học từ cấp nào. Kết quả chỉ để gợi ý lộ trình, không thay cho bài thi JLPT thật.",
        meta: `<b>40</b><span>câu tối đa · 10–15 phút</span>` }) +
        `<section class="sec"><div class="wrap test-intro">
          <div class="card test-card"><div class="test-card__in">
            <h2>Trước khi bắt đầu</h2>
            <ul class="facts">
              <li><b>5 phần, từ N5 đến N1</b><span>Mỗi phần 8 câu trắc nghiệm. Nếu một phần đúng dưới một nửa, bài test dừng ở đó, nên người mới học chỉ mất vài phút.</span></li>
              <li><b>Ba dạng câu hỏi</b><span>Nghĩa của từ, điền từ vào cụm, và chọn cách đọc của từ Kanji. Câu nghĩa và câu điền từ có furigana, câu cách đọc thì không.</span></li>
              <li><b>Không biết thì bấm “Chưa biết”</b><span>Đừng đoán bừa, vì đoán may sẽ làm kết quả lệch. Bài test không hiện đúng sai giữa chừng.</span></li>
              <li><b>Không ảnh hưởng tiến độ học</b><span>Chỉ khi bạn chọn, các từ làm sai mới được thêm vào danh sách cần ôn.</span></li>
            </ul>
            <div class="hero__actions"><button class="btn btn--primary" type="button" data-start>Bắt đầu làm bài</button>
              <a class="btn btn--ghost" href="#/n5">Mới học? Bỏ qua, bắt đầu từ N5</a></div>
          </div></div>
          ${last ? `<aside class="card test-last"><div class="test-card__in"><h3>Lần làm gần nhất</h3><p>${fmtDate(last.at)} · ${mmss(last.secs)} phút</p>
            <p class="test-last__r">${last.start === "done" ? "Rất vững N1" : `Nên học từ <b>${lvName(last.start)}</b>`}</p>
            <button class="btn btn--ghost btn--sm" type="button" data-last>Xem lại kết quả</button></div></aside>` : ""}
        </div></section>`;
      $("[data-start]").onclick = begin;
      const lb = $("[data-last]"); if (lb) lb.onclick = () => result(last, null);
    };
    function begin() {
      ST.stages = plBuild(); ST.s = 0; ST.k = 0; ST.t0 = Date.now(); ST.finished = false;
      stopTimer();
      ST.timer = setInterval(tick, 1000);
      ask();
    }
    const left = () => PL.limit - Math.floor((Date.now() - ST.t0) / 1000);
    function tick() {
      const el = $("[data-timer]"); const l = left();
      if (el) { el.textContent = mmss(l); el.closest(".test-time").classList.toggle("is-low", l <= 120); }
      if (l <= 0 && !ST.finished) finish(true);
    }
    function ask() {
      const stg = ST.stages[ST.s], q = stg.qs[ST.k];
      const segs = ST.stages.map((x, i) => `<li class="${i < ST.s ? "is-done" : i === ST.s ? "is-now" : ""}"><span>${lvName(x.lv)}</span><i style="width:${i < ST.s ? 100 : i === ST.s ? Math.round(ST.k / x.qs.length * 100) : 0}%"></i></li>`).join("");
      const e = q.e;
      let stem;
      if (q.kind === "mean") stem = `<p class="test-ask">Từ này có nghĩa là gì?</p><div class="say" lang="ja">${jp(e.w, { hl: false, kanji: true, furi: true })}</div>`;
      else if (q.kind === "cloze") stem = `<p class="test-ask">Chọn từ điền vào chỗ trống</p><div class="say say--sm" lang="ja">${jp(e.c, { blank: true, kanji: true, furi: true })}</div><div class="card__hint">${esc(e.cv)}</div>`;
      else stem = `<p class="test-ask">Chọn cách đọc đúng của từ này</p><div class="say" lang="ja">${jp(surf(e.w), { hl: false, kanji: true, furi: false })}</div>`;
      const label = (o) => q.kind === "cloze" ? jp(o.w, { hl: false, kanji: true, furi: true }) : esc(o);
      main.innerHTML = `<section class="study test-run"><div class="wrap">
        <div class="test-bar">
          <ol class="segs" aria-label="Tiến độ các phần">${segs}</ol>
          <div class="test-time" title="Thời gian còn lại"><span aria-hidden="true">⏱</span> <b data-timer>${mmss(left())}</b></div>
        </div>
        <div class="card"><div class="quiz">
          <div class="card__top"><span class="lvtag" data-lv="${stg.lv}">Phần ${lvName(stg.lv)}</span><span>${PL_KIND[q.kind]}</span><span class="card__num">${ST.k + 1} <small>/ ${stg.qs.length}</small></span></div>
          <div class="quiz__q">${stem}</div>
          <div class="opts">${q.opts.map((o, i) => `<button class="opt${q.kind === "mean" ? "" : " jp-opt"}" type="button" data-o="${i}" ${q.kind === "mean" ? "" : 'lang="ja"'}><span class="k">${i + 1}</span><span>${label(o)}</span></button>`).join("")}</div>
          <div class="card__actions"><button class="btn btn--ghost" type="button" data-skip>Chưa biết</button></div>
        </div></div>
        <p class="kbd-hint"><kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>0</kbd> chưa biết</p>
      </div></section>`;
      $$("[data-o]").forEach(b => b.addEventListener("click", () => answer(+b.dataset.o, b)));
      $("[data-skip]").onclick = () => answer(-1);
      window.scrollTo(0, 0);
    }
    let locked = false;
    function answer(i, btn) {
      if (locked || ST.finished) return;
      locked = true;
      const stg = ST.stages[ST.s]; stg.qs[ST.k].pick = i;
      if (btn) btn.classList.add("is-pick");
      $$("[data-o],[data-skip]").forEach(b => { b.disabled = true; });
      setTimeout(() => {
        locked = false;
        if (ST.finished || ST.dead) return;
        ST.k++;
        if (ST.k >= stg.qs.length) {
          const right = stg.qs.filter(q => q.pick === q.ans).length;
          if (right / stg.qs.length < PL.stop || ST.s >= ST.stages.length - 1) return finish(false);
          ST.s++; ST.k = 0;
        }
        ask();
      }, calm() ? 60 : 220);
    }
    function finish(timedOut) {
      if (ST.finished) return;
      ST.finished = true; stopTimer();
      const secs = Math.min(PL.limit, Math.floor((Date.now() - ST.t0) / 1000));
      const v = plVerdict(ST.stages, timedOut);
      const rec = { at: Date.now(), secs, start: v.start, solid: v.solid, per: v.per.map(p => [p.lv, p.right, p.total]), timedOut: !!timedOut };
      store.set("placement", rec); notify();
      result(rec, ST.stages);
    }
    function result(rec, stages) {
      stopTimer();
      const per = rec.per.map(([lv, right, total]) => ({ lv, right, total, pct: total ? right / total : 0 }));
      const right = per.reduce((s, p) => s + p.right, 0), total = per.reduce((s, p) => s + p.total, 0);
      const st = p => p.pct >= PL.pass ? "vung" : p.pct >= PL.stop ? "dang" : "chua";
      const stTxt = { vung: "Vững", dang: "Đang học dở", chua: "Cần học" };
      const start = rec.start;
      const book = { n5: "minna", n4: "minna", n3: "mimi-n3", n2: "mimi-n2", n1: "mimi-n1" }[start === "done" ? "n1" : start];
      const headline = start === "done" ? "Vốn từ của bạn rất vững, đã chạm tới N1" : start === "n5" ? "Bạn nên bắt đầu từ N5" : `Vốn từ của bạn vững tới ${rec.solid ? lvName(rec.solid) : "N5"}, nên học tiếp từ ${lvName(start)}`;
      const wrong = stages ? stages.flatMap(s => s.qs.filter(q => q.pick != null && q.pick !== q.ans)) : [];   // chỉ tính câu đã được hỏi
      const kinds = {};
      if (stages) stages.forEach(s => s.qs.filter(q => q.pick != null).forEach(q => { const k = kinds[q.kind] = kinds[q.kind] || [0, 0]; k[1]++; if (q.pick === q.ans) k[0]++; }));
      main.innerHTML = band({ big: "結果", bigJp: true, title: "Kết quả test đầu vào", compact: true, crumb: "Về trang test", crumbHref: "#/test",
        text: "", meta: `<b>${right}/${total}</b><span>câu đúng · ${mmss(rec.secs)} phút${rec.timedOut ? " (hết giờ)" : ""}</span>` }) +
        `<section class="sec"><div class="wrap test-result">
          <div class="card"><div class="done test-done">${scoreRing(right, total)}
            <h3>${headline}</h3>
            <p class="done__msg">${start === "done" ? "Hãy luyện thêm gói chuyên ngành và ôn các từ cần ôn để giữ phong độ." : `Bắt đầu từ ${lvName(start)} để lấp các khoảng trống, vì từ cấp này trở đi bạn chưa đạt mức vững.`}</p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#/${start === "done" ? "n1" : start}">${start === "done" ? "Học N1" : `Bắt đầu học ${lvName(start)}`}</a>
              <a class="btn btn--ghost" href="#/giao-trinh/${book}">Theo giáo trình ${book === "minna" ? "Minna no Nihongo" : "Mimikara " + lvName(start === "done" ? "n1" : start)}</a>
            </div></div></div>
          <div class="card"><div class="test-card__in">
            <h3>Điểm theo từng cấp</h3>
            <ul class="lvbars">${per.map(p => `<li><span class="lvtag" data-lv="${p.lv}">${lvName(p.lv)}</span>
              <span class="meter" role="img" aria-label="${p.right} trên ${p.total}"><i style="width:${Math.round(p.pct * 100)}%"></i></span>
              <b>${p.right}/${p.total}</b><em class="st st--${st(p)}">${stTxt[st(p)]}</em></li>`).join("")}
              ${PL.lvs.filter(lv => !per.some(p => p.lv === lv)).map(lv => `<li class="is-skip"><span class="lvtag" data-lv="${lv}">${lvName(lv)}</span><span class="meter"><i style="width:0"></i></span><b>—</b><em class="st">Chưa làm</em></li>`).join("")}
            </ul>
            ${Object.keys(kinds).length ? `<h3>Theo dạng câu hỏi</h3><ul class="kinds">${Object.entries(kinds).map(([k, [a, b]]) => `<li><span>${PL_KIND[k]}</span><b>${a}/${b}</b></li>`).join("")}</ul>` : ""}
            <p class="test-note">Mỗi cấp chỉ có 8 câu nên đây là ước lượng nhanh. Làm lại vài lần, hoặc học thử vài gói rồi kiểm tra lại để thấy rõ hơn.</p>
          </div></div>
          ${wrong.length ? `<div class="card"><div class="test-card__in">
            <div class="test-wrong__head"><h3>${wrong.length} câu chưa đúng</h3>
              <button class="btn btn--coral btn--sm" type="button" data-addrv>Thêm vào danh sách cần ôn</button></div>
            <ul class="test-wrong">${wrong.map(q => `<li><span class="lvtag" data-lv="${q.e.lv}">${lvName(q.e.lv)}</span>
              <span class="jp" lang="ja">${jp(q.e.w, { hl: false, kanji: true, furi: true })}</span>
              <span>${esc(q.e.vi)}${q.e.hv ? ` · <span class="hv">${esc(q.e.hv)}</span>` : ""}</span>${q.pick === -1 ? '<em class="st">Chưa biết</em>' : ""}</li>`).join("")}</ul>
          </div></div>` : ""}
          <div class="hero__actions"><button class="btn btn--primary" type="button" data-again>Làm lại bài test</button><a class="btn btn--ghost" href="#/">Về trang chủ</a></div>
        </div></section>`;
      afterDone($(".test-done"), right, total);
      const back = $(".crumb"); if (back) back.addEventListener("click", ev => { ev.preventDefault(); intro(); });
      $("[data-again]").onclick = () => { location.hash === "#/test" ? intro() : (location.hash = "#/test"); };
      const add = $("[data-addrv]");
      if (add) add.onclick = () => { wrong.forEach(q => mark(q.e.id, "rv")); add.disabled = true; add.textContent = "Đã thêm vào danh sách cần ôn"; toast(`Đã thêm ${wrong.length} từ vào danh sách cần ôn`); };
    }
    const onKey = ev => {
      if (!ST.stages || ST.finished || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (/^[1-4]$/.test(ev.key)) { const b = $(`[data-o="${+ev.key - 1}"]`); if (b && !b.disabled) answer(+ev.key - 1, b); }
      else if (ev.key === "0") answer(-1);
    };
    document.addEventListener("keydown", onKey);
    // refresh rỗng: bật tắt Kanji/furigana/romaji (phím K, F, R) không được làm mất bài đang làm
    current = { refresh() { /* bài test dùng cách hiển thị cố định */ }, destroy() { ST.dead = true; stopTimer(); document.removeEventListener("keydown", onKey); } };
    intro();
  }

  /* ------------------------------------------------------------ cấp độ */
  async function level(lv) {
    const L = levelOf(lv);
    if (!L) return notFound();
    const tabs = `<nav class="lvtabs" aria-label="Cấp độ">${C.levels.map(l => `<a href="#/${l.id}" ${l.id === lv ? 'aria-current="page"' : ""}>${l.name}</a>`).join("")}</nav>`;
    if (!L.ready) {
      const per = Math.round(L.target / L.plan.length);
      main.innerHTML = band({ big: L.name, title: `Từ vựng ${L.name}`, text: esc(L.blurb), extra: tabs,
        meta: `<b>${fmt(L.target)}</b><span>mục từ, đang biên soạn</span>` }) +
        `<section class="sec"><div class="wrap">
          <div class="sec__head"><h2>Kế hoạch chủ đề</h2><p class="sec__lead">Các gói dưới đây sẽ mở lần lượt. Trong lúc chờ, bạn có thể ôn các cấp đã sẵn sàng.</p></div>
          <ul class="rows">${L.plan.map(([ja, vi]) => `<li class="row row--off"><div>
            <span><span class="row__ja" lang="ja">${jp(ja, { hl: false })}</span><br><span class="row__vi">${esc(vi)}</span></span>
            <span class="row__side"><b>~${per}</b> mục<br><span class="pill pill--soon">Sắp có</span></span></div></li>`).join("")}</ul>
        </div></section>`;
      current = { refresh: () => level(lv) };
      return;
    }
    const D = await load(lv);
    const items = D.topics.flatMap(t => t.items);
    const ok = learnedIn(items);
    main.innerHTML = band({ big: L.name, title: `Từ vựng ${L.name}`, text: esc(L.blurb), extra: tabs,
      meta: `<b>${fmt(ok)} / ${fmt(items.length)}</b><span>mục đã học</span>${meter(ok, items.length)}` }) +
      `<section class="sec"><div class="wrap">
        <div class="sec__head"><h2>${D.topics.length} gói chủ đề</h2><p class="sec__lead">Mỗi gói có đủ bốn chế độ luyện và tải được về Anki, Quizlet hoặc Excel.</p></div>
        <ul class="rows">${D.topics.map(t => {
          const k = learnedIn(t.items);
          return `<li class="row"><a href="#/${lv}/${t.id}">
            <span><span class="row__ja" lang="ja">${jp(t.ja, { hl: false })}</span><br><span class="row__vi">${esc(t.vi)}</span></span>
            <span class="row__side"><b>${t.items.length}</b> mục<br>${k ? `đã học ${k}` : "chưa học"}${meter(k, t.items.length)}</span></a></li>`;
        }).join("")}</ul>
      </div></section>`;
    current = { refresh: () => level(lv) };
  }

  async function topicStudy(lv, tid) {
    const D = await load(lv);
    const T = D.topics.find(t => t.id === tid);
    if (!T) return notFound();
    const L = levelOf(lv);
    study({ title: `${L.name} · ${T.vi}`, titleJa: T.ja, sub: T.desc, crumb: `Các chủ đề ${L.name}`, crumbHref: `#/${lv}`,
      items: T.items, file: `minh-dokkai-${lv}-${tid}` });
  }

  /* ------------------------------------------------------------ màn học */
  function cardFrontHTML(e, i, n, demo) {
    const phrase = e.c || e.w;
    const rm = e.c ? e.cr : e.rm;
    const st = stateOf(e.id);
    return `<div class="card"><div class="card__face card__face--front" ${demo ? "" : 'data-flip tabindex="0" role="button" aria-label="Lật thẻ"'}>
      <div class="card__top">${lvtag(e.lv)}<span>${esc(posName(e.p))}</span>${e.c ? "<span>· cụm từ</span>" : ""}
        ${st === "ok" ? '<span class="state state--ok">Đã học</span>' : st === "rv" ? '<span class="state state--rv">Cần ôn</span>' : ""}
        ${demo ? "" : `<span class="card__num">${String(i + 1).padStart(3, "0")} <small>/ ${n}</small></span>`}</div>
      <div class="card__main">
        <div class="say${phrase.length > 40 ? " say--sm" : ""}" lang="ja">${jp(phrase)}</div>
        ${S.romaji ? `<div class="romaji">${esc(rm)}</div>` : ""}
        ${demo ? `<div class="back__mean" style="font-size:20px">${esc(meaningOf(e))}</div><div class="card__hint">${esc(e.vi)}${e.hv ? ` · <span class="hv">${esc(e.hv)}</span>` : ""}</div>` : ""}
      </div>
      <div class="card__actions"><button class="icon-btn" type="button" data-say="${esc(kana(phrase))}">${ICON_SPEAK} Nghe</button>
        ${demo ? "" : `<button class="icon-btn" type="button" data-flip>${ICON_FLIP} Lật thẻ</button>`}</div>
    </div></div>`;
  }
  function cardBackHTML(e) {
    return `<div class="card"><div class="card__face back" data-flip tabindex="0" role="button" aria-label="Lật lại mặt trước">
      <div class="card__top">${lvtag(e.lv)}<span>Nghĩa và ví dụ</span></div>
      <div class="back__mean">${esc(meaningOf(e))}</div>
      ${e.c ? `<div class="back__phrase" lang="ja">${jp(e.c)}</div>` : ""}
      <dl class="back__word">
        <dt>Từ</dt><dd class="jp" lang="ja">${jp(e.w, { hl: false })}${S.romaji ? ` <span class="romaji">${esc(e.rm)}</span>` : ""}</dd>
        <dt>Nghĩa</dt><dd>${esc(e.vi)}</dd>
        ${e.hv ? `<dt>Hán Việt</dt><dd class="hv">${esc(e.hv)}</dd>` : ""}
        <dt>Từ loại</dt><dd>${esc(posName(e.p))}</dd>
      </dl>
      <div class="ex"><div class="ex__ja" lang="ja">${jp(e.e, { hl: false })}</div><div class="ex__vi">${esc(e.ev)}</div></div>
      <div class="card__actions"><button class="icon-btn" type="button" data-say="${esc(kana(e.e))}">${ICON_SPEAK} Nghe câu ví dụ</button>
        <button class="icon-btn" type="button" data-flip>${ICON_FLIP} Xem mặt trước</button></div>
    </div></div>`;
  }
  function bindSpeak(root) {
    $$("[data-say]", root).forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); speak(b.dataset.say); }));
  }

  function study(cfg) {
    const items = cfg.items;
    const st = { mode: cfg.mode || "card", i: 0, flip: false, quiz: null, write: null, match: null, listOpen: false };
    const report = (box, mode, right, total) => { if (box.reported || !cfg.onResult) return; box.reported = true; cfg.onResult(mode, right, total); };
    main.innerHTML = band({ big: "", title: `${cfg.titleJa ? `<span lang="ja" class="jp" style="display:block;font-size:.72em;color:#bcd3d1;margin-bottom:4px">${jp(cfg.titleJa, { hl: false })}</span>` : ""}${esc(cfg.title)}`,
        crumb: cfg.crumb, crumbHref: cfg.crumbHref, text: esc(cfg.sub || ""), compact: true, extra: cfg.extra || "",
        meta: `<div class="dl"><button class="btn btn--ghost btn--sm" type="button" data-dl aria-expanded="false">Tải bộ từ</button>
          <div class="dl__menu" hidden><p>Tải ${items.length} mục của gói này để nhập vào Anki, Quizlet hoặc bảng tính.</p>
          <button type="button" data-fmt="tsv">.TSV <span>Anki, Quizlet</span></button><button type="button" data-fmt="csv">.CSV <span>Excel, Google Sheets</span></button></div></div>` })
      .replace('<div class="band__big"', '<div class="band__big" hidden') +
      `<section class="study"><div class="wrap">
        <div class="study__bar">
          <div class="modes" role="group" aria-label="Chế độ luyện tập">
            <button type="button" data-mode="card"><span class="jp" lang="ja">札</span>Học thẻ</button>
            <button type="button" data-mode="quiz"><span class="jp" lang="ja">択</span>Trắc nghiệm</button>
            <button type="button" data-mode="write"><span class="jp" lang="ja">書</span>Viết lại</button>
            <button type="button" data-mode="match"><span class="jp" lang="ja">合</span>Ghép cặp</button>
          </div>
          <div class="study__stats"><span>Đã học <b data-s-ok></b></span><span class="rv">Cần ôn <b data-s-rv></b></span>
            <button class="btn btn--ghost btn--sm only-m" type="button" data-list>Danh sách</button></div>
        </div>
        <div class="study__grid"><div data-stage></div>
          <aside class="aside" aria-label="Danh sách mục từ"><div class="aside__head"><b>${items.length} mục từ</b>
            <button class="btn btn--ghost btn--sm only-m" type="button" data-list>Đóng</button></div><ol class="wl" data-wl></ol></aside>
        </div>
      </div></section>`;
    const stage = $("[data-stage]"), wl = $("[data-wl]"), aside = $(".aside");

    // tải file
    const dlBtn = $("[data-dl]"), dlMenu = $(".dl__menu");
    dlBtn.addEventListener("click", () => { const open = dlMenu.hidden; dlMenu.hidden = !open; dlBtn.setAttribute("aria-expanded", open); });
    $$("[data-fmt]").forEach(b => b.addEventListener("click", () => { download(items, cfg.file, b.dataset.fmt); dlMenu.hidden = true; dlBtn.setAttribute("aria-expanded", "false"); }));
    const closeMenu = ev => { if (!ev.target.closest(".dl")) { dlMenu.hidden = true; dlBtn.setAttribute("aria-expanded", "false"); } };
    document.addEventListener("click", closeMenu);

    // danh sách bên
    let scrim = null;
    const setList = open => {
      st.listOpen = open; aside.classList.toggle("open", open);
      if (open && !scrim) { scrim = document.createElement("div"); scrim.className = "scrim"; scrim.onclick = () => setList(false); document.body.appendChild(scrim); }
      if (!open && scrim) { scrim.remove(); scrim = null; }
    };
    $$("[data-list]").forEach(b => b.addEventListener("click", () => setList(!st.listOpen)));
    function paintList() {
      wl.innerHTML = items.map((e, i) => `<li><button type="button" data-go="${i}" ${st.mode === "card" && i === st.i ? 'aria-current="true"' : ""}>
        <span class="wl__i">${String(i + 1).padStart(3, "0")}</span>
        <span class="wl__w" lang="ja">${jp(e.w, { hl: false })}<span class="wl__v">${esc(e.vi)}</span></span>
        <span class="dot ${stateOf(e.id) ? "dot--" + stateOf(e.id) : ""}"></span></button></li>`).join("");
    }
    wl.addEventListener("click", ev => {
      const b = ev.target.closest("[data-go]"); if (!b) return;
      st.mode = "card"; st.i = +b.dataset.go; st.flip = false; setList(false); paint();
    });
    function paintStats() {
      $("[data-s-ok]").textContent = `${learnedIn(items)}/${items.length}`;
      $("[data-s-rv]").textContent = items.filter(e => P.rv[e.id]).length;
    }

    // chế độ
    $$("[data-mode]").forEach(b => b.addEventListener("click", () => { st.mode = b.dataset.mode; st.flip = false; paint(); }));

    function paint(dir) {
      $$("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === st.mode));
      if (st.mode === "card") paintCard(typeof dir === "string" ? dir : "");
      if (st.mode === "quiz") paintQuiz();
      if (st.mode === "write") paintWrite();
      if (st.mode === "match") paintMatch();
      paintStats(); paintList();
    }

    /* --- học thẻ --- */
    function paintCard(dir) {
      const e = items[st.i];
      stage.innerHTML = `<div class="flip${st.flip ? " is-flipped" : ""}${dir ? " deal-" + dir : ""}"><div class="flip__inner">${cardFrontHTML(e, st.i, items.length)}${cardBackHTML(e)}</div></div>` +
        `<div class="ctl"><button class="btn btn--coral" type="button" data-act="rv">↺ Chưa thuộc</button>
          <button class="nav-btn prev" type="button" data-act="prev" aria-label="Mục trước">‹</button>
          <button class="nav-btn" type="button" data-act="next" aria-label="Mục sau">›</button>
          <button class="btn btn--primary" type="button" data-act="ok">✓ Đã học</button></div>
        <p class="kbd-hint"><kbd>Space</kbd> lật thẻ · <kbd>←</kbd><kbd>→</kbd> chuyển thẻ · <kbd>1</kbd> chưa thuộc · <kbd>2</kbd> đã học · <kbd>K</kbd> Kanji · <kbd>F</kbd> furigana</p>
        <p class="swipe-hint" aria-hidden="true"><span>‹</span> Vuốt phải: thẻ trước · Vuốt trái: thẻ sau <span>›</span></p>`;
      bindSpeak(stage);
      syncFaces();
      $$("[data-flip]", stage).forEach(el => el.addEventListener("click", ev => {
        ev.stopPropagation();
        if (ev.target.closest("[data-say]")) return;
        if (performance.now() - swipedAt < 400) return;   // vừa vuốt xong thì không tính là chạm để lật
        turn();
      }));
      $$("[data-act]", stage).forEach(b => b.addEventListener("click", () => act(b.dataset.act)));
      bindSwipe();
    }

    /* vuốt trái = thẻ sau, vuốt phải = thẻ trước (cảm ứng và chuột); cuộn dọc vẫn hoạt động bình thường */
    let swipedAt = -1e9;
    function bindSwipe() {
      const f = $(".flip", stage); if (!f) return;
      let pid = null, sx = 0, sy = 0, dx = 0, t0 = 0, axis = null;
      const reset = (anim) => {
        f.classList.remove("dragging");
        f.style.transition = anim ? "transform .22s cubic-bezier(.2,.8,.3,1), opacity .22s" : "";
        f.style.transform = ""; f.style.opacity = "";
        if (anim) setTimeout(() => { f.style.transition = ""; }, 240);
      };
      f.addEventListener("pointerdown", ev => {
        if (pid !== null || (ev.pointerType === "mouse" && ev.button !== 0)) return;
        if (ev.target.closest("[data-say], .icon-btn")) return;
        pid = ev.pointerId; sx = ev.clientX; sy = ev.clientY; dx = 0; t0 = performance.now(); axis = null;
      });
      f.addEventListener("pointermove", ev => {
        if (ev.pointerId !== pid) return;
        const mx = ev.clientX - sx, my = ev.clientY - sy;
        if (!axis) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
          if (axis === "x") { try { f.setPointerCapture(pid); } catch (e) { /* bỏ qua */ } f.classList.add("dragging"); }
        }
        if (axis !== "x") return;
        dx = mx;
        const lim = Math.min(Math.abs(dx), 140) * Math.sign(dx);
        f.style.transition = "none";
        f.style.transform = `translateX(${dx}px) rotate(${Math.max(-8, Math.min(8, lim / 18))}deg)`;
        f.style.opacity = String(1 - Math.min(Math.abs(dx) / 420, .45));
      });
      const finish = ev => {
        if (ev.pointerId !== pid) return;
        const was = axis; pid = null; axis = null;
        if (was !== "x") return;
        swipedAt = performance.now();
        const dt = Math.max(1, performance.now() - t0), v = Math.abs(dx) / dt;
        const far = Math.abs(dx) > Math.min(90, f.offsetWidth * .2) || (Math.abs(dx) > 36 && v > .5);
        if (ev.type === "pointercancel" || !far) return reset(true);
        const dir = dx < 0 ? "next" : "prev";
        if (calm()) { reset(false); return act(dir); }
        f.style.transition = "transform .16s ease-in, opacity .16s";
        f.style.transform = `translateX(${dx < 0 ? "-" : ""}${Math.max(f.offsetWidth, 280)}px) rotate(${dx < 0 ? -10 : 10}deg)`;
        f.style.opacity = "0";
        setTimeout(() => act(dir), 150);
      };
      f.addEventListener("pointerup", finish);
      f.addEventListener("pointercancel", finish);
    }
    function syncFaces() {
      const f = $(".flip", stage); if (!f) return;
      const [front, back] = $$(".flip__inner > .card", f);
      front.inert = st.flip; back.inert = !st.flip;
      front.setAttribute("aria-hidden", st.flip); back.setAttribute("aria-hidden", !st.flip);
    }
    function turn() {
      const f = $(".flip", stage); if (!f) return;
      st.flip = !st.flip;
      f.classList.remove("deal-next", "deal-prev");
      f.classList.toggle("is-flipped", st.flip);
      syncFaces();
      const face = $$(".flip__inner > .card", f)[st.flip ? 1 : 0];
      const btn = $("button[data-flip]", face); if (btn) btn.focus({ preventScroll: true });
    }
    function act(a) {
      let dir = a === "prev" ? "prev" : "next";
      if (a === "prev") { st.i = (st.i - 1 + items.length) % items.length; st.flip = false; }
      if (a === "next") { st.i = (st.i + 1) % items.length; st.flip = false; }
      if (a === "ok" || a === "rv") {
        mark(items[st.i].id, a);
        if (a === "rv") toast("Đã thêm vào danh sách cần ôn");
        st.i = (st.i + 1) % items.length; st.flip = false;
      }
      paint(dir);
      const cur = $('[aria-current="true"]', wl);
      if (cur) { const top = cur.offsetTop - wl.offsetTop, h = wl.clientHeight; if (top < wl.scrollTop || top > wl.scrollTop + h - cur.offsetHeight) wl.scrollTop = top - h / 3; }
    }

    /* --- trắc nghiệm --- */
    function newQuiz() { st.streak = 0; st.quiz = { deck: shuffle(items), k: 0, right: 0, wrong: [], answered: null, opts: null }; }
    function makeOpts(e) {
      const same = shuffle(items.filter(x => x !== e && meaningOf(x) !== meaningOf(e) && x.p.split(",")[0][0] === e.p[0]));
      const rest = shuffle(items.filter(x => x !== e && meaningOf(x) !== meaningOf(e) && !same.includes(x)));
      const picks = [];
      for (const x of [...same, ...rest]) { if (picks.length === 3) break; if (!picks.some(p => meaningOf(p) === meaningOf(x) || surf(p.c || p.w) === surf(x.c || x.w))) picks.push(x); }
      return shuffle([e, ...picks]);
    }
    function paintQuiz() {
      if (!st.quiz) newQuiz();
      const q = st.quiz;
      if (q.k >= q.deck.length) {
        stage.innerHTML = doneHTML(`Xong ${q.deck.length} câu`, q.right, q.deck.length, `Đúng ${q.right}, sai ${q.wrong.length}. Các câu sai đã nằm trong danh sách cần ôn.`,
          `<button class="btn btn--primary" type="button" data-again>Làm lại</button>${q.wrong.length ? '<button class="btn btn--ghost" type="button" data-wrong>Chỉ làm lại câu sai</button>' : ""}`);
        afterDone(stage, q.right, q.deck.length);
        report(q, "quiz", q.right, q.deck.length);
        $("[data-again]", stage).onclick = () => { newQuiz(); paintQuiz(); };
        const w = $("[data-wrong]", stage); if (w) w.onclick = () => { const d = shuffle(q.wrong); newQuiz(); st.quiz.deck = d; st.quiz.reported = true; paintQuiz(); };
        return;
      }
      const e = q.deck[q.k];
      if (!q.opts) q.opts = makeOpts(e);
      const jv = S.quizDir === "jv";
      const prompt = jv ? `<div class="say" lang="ja">${jp(e.c || e.w)}</div>${S.romaji ? `<div class="romaji">${esc(e.c ? e.cr : e.rm)}</div>` : ""}`
                        : `<div class="back__mean">${esc(meaningOf(e))}</div>`;
      stage.innerHTML = `<div class="card"><div class="quiz">
        <div class="card__top"><button class="icon-btn quiz__dir" type="button" data-dir>${jv ? "Nhật → Việt" : "Việt → Nhật"}</button>
          <span class="card__num">${q.k + 1} <small>/ ${q.deck.length}</small></span></div>
        <div class="quiz__q">${prompt}${jv ? `<button class="icon-btn" type="button" data-say="${esc(kana(e.c || e.w))}">${ICON_SPEAK} Nghe</button>` : ""}</div>
        <div class="opts">${q.opts.map((o, i) => `<button class="opt${jv ? "" : " jp-opt"}" type="button" data-o="${i}" ${jv ? "" : 'lang="ja"'}><span class="k">${i + 1}</span><span>${jv ? esc(meaningOf(o)) : jp(o.c || o.w, { hl: false })}</span></button>`).join("")}</div>
        <div class="feedback" aria-live="polite"></div>
        <div class="card__actions" data-next-wrap hidden><button class="btn btn--primary" type="button" data-next>Câu tiếp</button></div>
      </div></div>`;
      bindSpeak(stage);
      $("[data-dir]", stage).onclick = () => { S.quizDir = jv ? "vj" : "jv"; saveS(); paintQuiz(); };
      $$("[data-o]", stage).forEach(b => b.addEventListener("click", () => answerQuiz(+b.dataset.o)));
      $("[data-next]", stage).onclick = nextQuiz;
      if (q.answered != null) answerQuiz(q.answered, true);
    }
    function answerQuiz(i, replay) {
      const q = st.quiz, e = q.deck[q.k];
      if (q.answered != null && !replay) return;
      const right = q.opts[i] === e;
      if (!replay) {
        q.answered = i;
        q.word = pickWord(right);
        st.streak = right ? (st.streak || 0) + 1 : 0; q.streak = st.streak;
        if (right) { q.right++; mark(e.id, "ok"); } else { q.wrong.push(e); mark(e.id, "rv"); }
        paintStats(); paintList();
      }
      $$("[data-o]", stage).forEach((b, k) => { b.disabled = true; if (q.opts[k] === e) b.classList.add("is-right"); else if (k === i) b.classList.add("is-wrong"); });
      const fb = $(".feedback", stage);
      fb.className = "feedback " + (right ? "ok" : "no");
      fb.innerHTML = verdictHTML(right, q.word, right ? "" : `Đáp án: <span lang="ja" class="jp">${jp(e.c || e.w, { hl: false })}</span> = ${esc(meaningOf(e))}`, q.streak);
      if (!replay) {
        verdict(fb, right);
        const picked = $$("[data-o]", stage)[i], card = $(".card", stage);
        if (right) { celebrate(picked, q.streak > 0 && q.streak % 5 === 0); glow(card, true); }
        else { wobble(picked); glow(card, false); buzz(); }
      }
      $("[data-next-wrap]", stage).hidden = false;
      $("[data-next]", stage).focus({ preventScroll: true });
    }
    function nextQuiz() { const q = st.quiz; q.k++; q.answered = null; q.opts = null; paintQuiz(); }

    /* --- viết lại --- */
    function newWrite() { st.streak = 0; st.write = { deck: shuffle(items), k: 0, right: 0, checked: false, ok: false, hint: false, value: "" }; }
    function paintWrite() {
      if (!st.write) newWrite();
      const w = st.write;
      if (w.k >= w.deck.length) {
        stage.innerHTML = doneHTML(`Xong ${w.deck.length} từ`, w.right, w.deck.length, `Viết đúng ${w.right}. Các từ viết sai đã vào danh sách cần ôn.`,
          `<button class="btn btn--primary" type="button" data-again>Viết lại từ đầu</button>`);
        afterDone(stage, w.right, w.deck.length);
        report(w, "write", w.right, w.deck.length);
        $("[data-again]", stage).onclick = () => { newWrite(); paintWrite(); };
        return;
      }
      const e = w.deck[w.k];
      const ctx = e.c && e.c.includes("{") ? `<div class="say say--sm" lang="ja">${jp(e.c, { blank: true })}</div><div class="card__hint">${esc(e.cv)}</div>` : "";
      stage.innerHTML = `<div class="card"><div class="quiz">
        <div class="card__top">${lvtag(e.lv)}<span>${esc(posName(e.p))}</span><span class="card__num">${w.k + 1} <small>/ ${w.deck.length}</small></span></div>
        <div class="quiz__q"><div class="back__mean">${esc(e.vi)}</div>${ctx}
          ${w.hint ? `<div class="card__hint">${e.hv ? `Hán Việt <span class="hv">${esc(e.hv)}</span>, ` : ""}bắt đầu bằng 「${esc(kana(e.w)[0])}」, ${kana(e.w).length} chữ kana</div>` : ""}</div>
        <form class="write" autocomplete="off">
          <label class="sr" for="wr-in">Gõ từ tiếng Nhật</label>
          <input id="wr-in" lang="ja" inputmode="text" autocapitalize="off" spellcheck="false" placeholder="Gõ kana, Kanji hoặc romaji" value="${esc(w.value)}" class="${w.checked ? (w.ok ? "ok" : "no") : ""}" ${w.checked ? "readonly" : ""}>
          <div class="write__row">${w.checked ? '<button class="btn btn--primary" type="submit">Từ tiếp theo</button>' :
            `<button class="btn btn--ghost" type="button" data-hint ${w.hint ? "disabled" : ""}>Gợi ý</button><button class="btn btn--ghost" type="button" data-skip>Bỏ qua</button><button class="btn btn--primary" type="submit">Kiểm tra</button>`}</div>
          <div class="feedback ${w.checked ? (w.ok ? "ok" : "no") : ""}" aria-live="polite">${w.checked ? verdictHTML(w.ok, w.word, `${w.ok ? "" : "Đáp án: "}<span lang="ja" class="jp" style="font-size:20px">${jp(e.w, { hl: false, kanji: true })}</span> <span class="romaji">${esc(e.rm)}</span>`, w.streak) : ""}</div>
          <small>Chấp nhận Kanji, hiragana, katakana hoặc romaji. Trường âm viết thiếu vẫn được tính đúng.</small>
        </form></div></div>`;
      const form = $("form", stage), input = $("#wr-in", stage);
      if (!w.checked) input.focus({ preventScroll: true });
      input.addEventListener("input", () => { w.value = input.value; });
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        if (w.checked) { w.k++; w.checked = false; w.ok = false; w.hint = false; w.value = ""; return paintWrite(); }
        if (!input.value.trim()) return input.focus();
        w.value = input.value;
        settle(checkAnswer(input.value, e));
      });
      const h = $("[data-hint]", stage); if (h) h.onclick = () => { w.hint = true; paintWrite(); };
      const sk = $("[data-skip]", stage); if (sk) sk.onclick = () => { w.value = ""; settle(false); };
      function settle(ok) {
        w.checked = true; w.ok = ok; w.word = pickWord(ok);
        st.streak = ok ? (st.streak || 0) + 1 : 0; w.streak = st.streak;
        if (ok) { w.right++; mark(e.id, "ok"); } else mark(e.id, "rv");
        paintWrite(); paintStats(); paintList();
        const inp = $("#wr-in", stage), fbw = $(".feedback", stage), card = $(".card", stage);
        verdict(fbw, ok);
        if (ok) { celebrate(inp, w.streak > 0 && w.streak % 5 === 0); glow(card, true); } else { wobble(inp); glow(card, false); buzz(); }
        $("button[type=submit]", stage).focus({ preventScroll: true });
      }
    }

    /* --- ghép cặp --- */
    function newMatch() { st.match = { deck: shuffle(items), round: 0, miss: 0, pairs: 0, done: {}, sel: null, order: null }; }
    function paintMatch() {
      if (!st.match) newMatch();
      const m = st.match, size = 6;
      const set = m.deck.slice(m.round * size, m.round * size + size);
      if (!set.length) {
        const tries = m.pairs + m.miss;
        stage.innerHTML = doneHTML(`Đã ghép xong ${m.pairs} cặp`, m.pairs, tries, `Ghép nhầm ${m.miss} lần.`, `<button class="btn btn--primary" type="button" data-again>Chơi lại</button>`);
        afterDone(stage, m.pairs, tries);
        $("[data-again]", stage).onclick = () => { newMatch(); paintMatch(); };
        return;
      }
      if (!m.order) m.order = { L: shuffle(set), R: shuffle(set) };
      const rounds = Math.ceil(m.deck.length / size);
      stage.innerHTML = `<div class="card"><div class="match">
        <div class="card__top"><span>Chọn một từ tiếng Nhật, rồi chọn nghĩa đúng</span><span class="card__num">Lượt ${m.round + 1} <small>/ ${rounds}</small></span></div>
        <div class="match__grid">
          <div class="match__col">${m.order.L.map(e => `<button class="tile jp-tile" type="button" lang="ja" data-l="${e.id}" ${m.done[e.id] ? "disabled" : ""}>${jp(e.w, { hl: false })}</button>`).join("")}</div>
          <div class="match__col">${m.order.R.map(e => `<button class="tile" type="button" data-r="${e.id}" ${m.done[e.id] ? "disabled" : ""}>${esc(e.vi)}</button>`).join("")}</div>
        </div>
        <div class="match__foot"><span>Ghép nhầm: <b>${m.miss}</b></span><button class="btn btn--ghost btn--sm" type="button" data-skipround>Bỏ lượt này</button></div>
      </div></div>`;
      $$(".tile", stage).forEach(t => { const id = t.dataset.l || t.dataset.r; if (m.done[id]) t.classList.add("is-done"); });
      $$(".tile", stage).forEach(t => t.addEventListener("click", () => pick(t)));
      $("[data-skipround]", stage).onclick = () => { m.round++; m.order = null; m.sel = null; paintMatch(); };
    }
    function pick(t) {
      const m = st.match;
      const side = t.dataset.l ? "l" : "r", id = t.dataset.l || t.dataset.r;
      if (!m.sel || m.sel.side === side) {
        $$(".tile.is-sel", stage).forEach(x => x.classList.remove("is-sel"));
        m.sel = { side, id }; t.classList.add("is-sel"); return;
      }
      const other = m.sel; m.sel = null;
      $$(".tile.is-sel", stage).forEach(x => x.classList.remove("is-sel"));
      if (other.id === id) {
        m.done[id] = 1; m.pairs++; mark(id, "ok");
        const pair = $$(`[data-l="${id}"],[data-r="${id}"]`, stage);
        pair.forEach(x => { x.classList.add("is-hit"); celebrate(x); });
        setTimeout(() => pair.forEach(x => { x.classList.remove("is-hit"); x.disabled = true; x.classList.add("is-done"); }), 380);
        paintStats(); paintList();
        if (m.order.L.every(e => m.done[e.id])) {
          setTimeout(() => { glow($(".card", stage), true); celebrate($(".match__grid", stage), true); }, 380);
          setTimeout(() => { m.round++; m.order = null; paintMatch(); }, 1100);
        }
      } else {
        m.miss++;
        const leftId = side === "l" ? id : other.id;
        mark(leftId, "rv"); paintStats(); paintList();
        const a = $(`[data-${other.side}="${other.id}"]`, stage);
        [t, a].forEach(x => { x.classList.add("is-wrong"); wobble(x); setTimeout(() => x.classList.remove("is-wrong"), 500); });
        buzz();
        $(".match__foot b", stage).textContent = m.miss;
      }
    }

    /* --- bàn phím --- */
    function onKey(ev) {
      if (ev.target.matches("input, textarea") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (st.mode === "card") {
        if (ev.key === " " || ev.key === "Enter") { if (ev.target.closest("button")) return; ev.preventDefault(); turn(); }
        else if (ev.key === "ArrowRight") act("next");
        else if (ev.key === "ArrowLeft") act("prev");
        else if (ev.key === "1") act("rv");
        else if (ev.key === "2") act("ok");
      } else if (st.mode === "quiz" && st.quiz) {
        if (/^[1-4]$/.test(ev.key) && st.quiz.answered == null) answerQuiz(+ev.key - 1);
        else if (ev.key === "Enter" && st.quiz.answered != null && !ev.target.closest("button")) nextQuiz();
      }
    }
    document.addEventListener("keydown", onKey);
    current = {
      refresh: paint,
      destroy() { document.removeEventListener("keydown", onKey); document.removeEventListener("click", closeMenu); if (scrim) scrim.remove(); }
    };
    paint();
  }

  /* ------------------------------------------------------------ tải bộ từ */
  function download(items, name, f) {
    const head = ["Từ", "Cách đọc", "Romaji", "Từ loại", "Hán Việt", "Nghĩa", "Cụm từ", "Cách đọc cụm", "Nghĩa cụm", "Ví dụ", "Cách đọc ví dụ", "Dịch ví dụ", "Cấp độ"];
    const rows = items.map(e => [surf(e.w), kana(e.w), e.rm, posName(e.p), e.hv, e.vi, surf(e.c), kana(e.c), e.cv, surf(e.e), kana(e.e), e.ev, e.lv.toUpperCase()]);
    let text;
    if (f === "tsv") text = [head, ...rows].map(r => r.map(c => String(c || "").replace(/[\t\n]/g, " ")).join("\t")).join("\n");
    else text = "﻿" + [head, ...rows].map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([text], { type: f === "tsv" ? "text/tab-separated-values;charset=utf-8" : "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${name}.${f}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Đã tải ${items.length} mục dạng .${f.toUpperCase()}`);
  }

  /* ------------------------------------------------------------ từ loại */
  const posGroup = id => C.pos.find(p => p.id === id);
  const inGroup = (g, e) => e.p.split(",").some(p => (g.codes || [g.id]).includes(p));
  const LVCOL = { n5: "var(--mint)", n4: "var(--step-4)", n3: "var(--step-3)", n2: "var(--green)", n1: "var(--green-deep)" };
  async function posList() {
    await loadAll();
    const all = allItems();
    main.innerHTML = band({ big: "品詞", bigJp: true, title: "Học theo từ loại", text: "Gom từ cùng loại qua mọi cấp độ. Nhãn N5–N1 nằm cạnh từng từ để bạn biết mình đang ở đâu.",
      meta: `<b>${fmt(all.length)}</b><span>mục từ đã mở</span>` }) +
      `<section class="sec"><div class="wrap"><ul class="posrows">${C.pos.map(g => {
        const its = all.filter(e => inGroup(g, e));
        const by = C.levels.map(l => [l.id, its.filter(e => e.lv === l.id).length]);
        return `<li><a href="#/tu-loai/${g.id}"><span><span class="row__ja" lang="ja">${jp(g.ja, { hl: false })}</span><br><span class="row__vi">${esc(g.label)}</span></span>
          <span class="row__side"><b>${fmt(its.length)}</b> mục<div class="lvbar" style="margin-top:6px">${by.filter(b => b[1]).map(([lv, n]) => `<i style="width:${its.length ? n / its.length * 100 : 0}%;background:${LVCOL[lv]}" title="${lv.toUpperCase()}: ${n}"></i>`).join("")}</div></span></a></li>`;
      }).join("")}</ul>
      <p class="sec__lead" style="margin-top:20px">Hiện mới mở cấp ${readyLevels().map(x => x.toUpperCase()).join(", ")}. Số mục sẽ tăng khi các cấp tiếp theo hoàn thành.</p></div></section>`;
  }
  const PACK = 50;
  function posFilter(g, q) {
    const cap = q.get("cap") || "all";
    return { cap, items: allItems().filter(e => inGroup(g, e) && (cap === "all" || e.lv === cap)) };
  }
  async function posDetail(gid, q) {
    const g = posGroup(gid); if (!g) return notFound();
    await loadAll();
    const { cap, items } = posFilter(g, q);
    let shown = 100;
    const packs = Math.ceil(items.length / PACK);
    main.innerHTML = band({ big: surf(g.ja).split("・")[0], bigJp: true, crumb: "Tất cả từ loại", crumbHref: "#/tu-loai",
        title: esc(g.label), text: "Lọc theo cấp độ, rồi chọn một gói 50 mục để luyện với đủ bốn chế độ.",
        meta: `<b>${fmt(items.length)}</b><span>mục ${cap === "all" ? "ở mọi cấp" : "cấp " + cap.toUpperCase()}</span>` }) +
      `<section class="sec" style="padding-top:32px"><div class="wrap">
        <div class="toolbar"><div class="chips" role="group" aria-label="Lọc cấp độ">
          <a class="chip" href="#/tu-loai/${gid}" ${cap === "all" ? 'aria-current="page"' : ""}>Tất cả</a>
          ${C.levels.map(l => l.ready ? `<a class="chip" href="#/tu-loai/${gid}?cap=${l.id}" ${cap === l.id ? 'aria-current="page"' : ""}>${l.name}</a>` : `<span class="chip" style="opacity:.45" title="Đang biên soạn">${l.name}</span>`).join("")}
        </div></div>
        ${items.length ? `<div class="toolbar"><b style="color:var(--green)">Chọn gói để luyện</b><div class="packs">${Array.from({ length: packs }, (_, i) =>
          `<a class="btn btn--ghost btn--sm" href="#/tu-loai/${gid}/hoc?cap=${cap}&goi=${i + 1}">Gói ${i + 1}: mục ${i * PACK + 1}–${Math.min(items.length, (i + 1) * PACK)}</a>`).join("")}</div></div>
        <table class="vt"><thead><tr><th>Cấp</th><th>Từ</th><th>Nghĩa</th><th>Cụm từ thông dụng</th></tr></thead><tbody data-tb></tbody></table>
        <div style="text-align:center;margin-top:16px"><button class="btn btn--ghost" type="button" data-more hidden>Hiện thêm 100 mục</button></div>` :
        `<div class="empty"><h3>Chưa có mục nào</h3><p>Cấp độ này chưa có ${esc(g.label.toLowerCase())}. Hãy chọn “Tất cả” hoặc một cấp khác.</p></div>`}
      </div></section>`;
    const tb = $("[data-tb]"), more = $("[data-more]");
    const paintRows = () => {
      if (!tb) return;
      tb.innerHTML = items.slice(0, shown).map(e => `<tr><td>${lvtag(e.lv)}</td>
        <td><span class="jp" lang="ja">${jp(e.w, { hl: false })}</span>${S.romaji ? `<div class="romaji" style="font-size:13px">${esc(e.rm)}</div>` : ""}</td>
        <td>${esc(e.vi)}${e.hv ? `<div class="hv" style="font-size:12px">${esc(e.hv)}</div>` : ""}</td>
        <td>${e.c ? `<span class="col-c" lang="ja">${jp(e.c, { hl: false })}</span><div class="muted">${esc(e.cv)}</div>` : '<span class="muted">Từ cơ bản, dùng trực tiếp</span>'}</td></tr>`).join("");
      if (more) more.hidden = shown >= items.length;
    };
    if (more) more.onclick = () => { shown += 100; paintRows(); };
    paintRows();
    current = { refresh: paintRows };
  }
  async function posStudy(gid, q) {
    const g = posGroup(gid); if (!g) return notFound();
    await loadAll();
    const { cap, items } = posFilter(g, q);
    const n = Math.max(1, +q.get("goi") || 1);
    const slice = items.slice((n - 1) * PACK, n * PACK);
    if (!slice.length) return notFound();
    study({ title: `${g.label} · gói ${n}`, sub: `${cap === "all" ? "Mọi cấp độ" : "Cấp " + cap.toUpperCase()}, mục ${(n - 1) * PACK + 1}–${(n - 1) * PACK + slice.length} trên ${items.length}.`,
      crumb: g.label, crumbHref: `#/tu-loai/${gid}${cap !== "all" ? "?cap=" + cap : ""}`, items: slice, file: `minh-dokkai-${gid}-${cap}-goi${n}` });
  }

  /* ------------------------------------------------------------ chuyên ngành */
  async function industries() {
    let D = null;
    if (C.industriesReady) D = await load("nganh");
    const total = D ? D.topics.reduce((n, t) => n + t.items.length, 0) : 0;
    main.innerHTML = band({ big: "職種", bigJp: true, title: "Gói chuyên ngành cho thực tập sinh", text: "Mười ngành có nhiều thực tập sinh và lao động kỹ năng đặc định người Việt nhất. Mỗi gói có cụm từ dùng thật ở xưởng, công trường, cơ sở chăm sóc và nhà hàng.",
      meta: D ? `<b>${fmt(total)}</b><span>mục từ chuyên ngành</span>` : `<b>${C.industries.length}</b><span>ngành, đang biên soạn</span>` }) +
      `<section class="sec"><div class="wrap"><ul class="rows">${C.industries.map(x => {
        const T = D && D.topics.find(t => t.id === x.id);
        const k = T ? learnedIn(T.items) : 0;
        return `<li class="row"><a href="#/nganh/${x.id}">
        <span><span class="row__ja" lang="ja">${jp(x.ja, { hl: false })}</span><br><span class="row__vi">${esc(x.vi)}</span><br><span class="row__sub">${esc(x.plan)}</span></span>
        <span class="row__side">${T ? `<b>${T.items.length}</b> mục<br>${k ? `đã học ${k}` : "chưa học"}${meter(k, T.items.length)}` : `<b>~${x.target}</b> mục<br><span class="pill pill--soon">Sắp có</span>`}</span></a></li>`;
      }).join("")}</ul></div></section>`;
    current = { refresh: industries };
  }
  async function industry(id) {
    const x = C.industries.find(i => i.id === id); if (!x) return notFound();
    const D = C.industriesReady ? await load("nganh") : null;
    const T = D && D.topics.find(t => t.id === id);
    if (T) {
      return study({ title: x.vi, titleJa: x.ja, sub: T.desc || x.plan, crumb: "Tất cả chuyên ngành", crumbHref: "#/nganh", items: T.items, file: `minh-dokkai-nganh-${id}` });
    }
    main.innerHTML = band({ big: surf(x.ja).split("・")[0], bigJp: true, crumb: "Tất cả chuyên ngành", crumbHref: "#/nganh",
      title: esc(x.vi), text: esc(x.plan), meta: `<b>~${x.target}</b><span>mục dự kiến</span>` }) +
      `<section class="sec"><div class="wrap"><div class="empty"><h3>Gói này đang được biên soạn</h3>
        <p>Khi hoàn thành, gói sẽ có đủ học thẻ, trắc nghiệm, viết lại, ghép cặp và tải về Anki. Trong lúc chờ, bạn có thể luyện nền tảng N5.</p>
        <a class="btn btn--primary" href="#/n5">Học N5</a></div></div></section>`;
    current = { refresh: () => industry(id) };
  }


  /* ------------------------------------------------------------ giáo trình */
  const booksReady = () => (C.books || []).filter(b => b.ready);
  let BOOKIDX = null;   // id mục -> mục, gồm mọi cấp + mục riêng của giáo trình
  async function loadBooks() {
    // giáo trình trỏ tới mục ở mọi cấp, kể cả cấp chưa mở trên trang chủ
    await Promise.allSettled(C.levels.map(l => load(l.id)));
    const G = await load("giaotrinh");
    if (!BOOKIDX) {
      BOOKIDX = new Map();
      C.levels.forEach(l => LV[l.id] && LV[l.id].topics.forEach(t => t.items.forEach(e => BOOKIDX.set(e.id, e))));
      if (LV.gt) LV.gt.topics.forEach(t => t.items.forEach(e => BOOKIDX.set(e.id, e)));
    }
    return G;
  }
  const bookData = (G, id) => G.books.find(b => b.id === id);
  const unitItems = u => u.ids.map(id => BOOKIDX.get(id)).filter(Boolean);
  const unitLabel = (b, u) => /^\d+$/.test(u.n) ? `${b.unitName} ${u.n}` : (u.title || u.n);
  const unitCode = (b, u) => /^\d+$/.test(u.n) ? u.n : u.n.replace(/^M/, "Σ");

  /* lộ trình học – ôn theo bài/Unit: đạt ≥80% trắc nghiệm hoặc viết lại là xong bài, rồi ôn sau 1, 3, 7, 14, 30 ngày */
  const GT_GAPS = [1, 3, 7, 14, 30], GT_PASS = .8;
  const dayNo = t => { const d = new Date(t); return Math.floor((t - d.getTimezoneOffset() * 6e4) / 864e5); };
  const gtRec = (bid, n) => (P.gt[bid] || {})[n];
  function gtState(bid, u) {
    const r = gtRec(bid, u.n);
    if (!r) { const its = unitItems(u); return { s: learnedIn(its) ? "doing" : "new" }; }
    if (r.st >= GT_GAPS.length) return { s: "solid", r };
    const left = dayNo(r.t) + GT_GAPS[r.st] - dayNo(Date.now());
    return left <= 0 ? { s: "due", k: r.st + 1, late: -left, r } : { s: "wait", k: r.st + 1, left, r };
  }
  function gtPass(b, u) {
    const bid = b.id, now = Date.now(), name = unitLabel(b, u);
    const box = P.gt[bid] = P.gt[bid] || {};
    const cur = gtState(bid, u);
    if (!box[u.n]) { box[u.n] = { t: now, st: 0, first: now }; saveP(); return `Hoàn thành ${name}. Lượt ôn đầu tiên: ngày mai.`; }
    if (cur.s === "due") {
      box[u.n].st++; box[u.n].t = now; saveP();
      return box[u.n].st >= GT_GAPS.length ? `${name} đã vững sau ${GT_GAPS.length} lượt ôn.` : `Xong lượt ôn ${cur.k}. Lượt tiếp theo sau ${GT_GAPS[box[u.n].st]} ngày.`;
    }
    return "";
  }
  const gtLabel = st => st.s === "due" ? `Ôn lượt ${st.k}${st.late ? ` · trễ ${st.late} ngày` : " · hôm nay"}`
    : st.s === "wait" ? (st.left === 1 ? `Ôn lượt ${st.k} ngày mai` : `Ôn lượt ${st.k} sau ${st.left} ngày`)
    : st.s === "solid" ? "Đã vững" : st.s === "doing" ? "Đang học" : "";
  const gtPassedItems = (bid, D) => D.units.filter(u => gtRec(bid, u.n)).flatMap(unitItems);
  function gtResult(b, u) {
    return (mode, right, total) => {
      if (!total) return;
      if (right / total < GT_PASS) { toast(`Đạt ${Math.round(right / total * 100)}%. Cần từ ${GT_PASS * 100}% để hoàn thành lượt này, hãy làm lại câu sai nhé.`); return; }
      const msg = gtPass(b, u); if (msg) setTimeout(() => toast(msg), 900);
    };
  }

  async function books() {
    const list = C.books || [];
    let G = null;
    if (booksReady().length) G = await loadBooks();
    const cards = list.map(b => {
      const D = G && b.ready && bookData(G, b.id);
      const items = D ? D.units.flatMap(unitItems) : [];
      const k = learnedIn(items);
      return `<li><a class="book${D ? "" : " book--off"}" href="#/giao-trinh/${b.id}">
        <span class="book__spine" aria-hidden="true"><span lang="ja">${b.id === "minna" ? "みんな" : "耳"}</span></span>
        <span class="book__body"><span class="book__lv">${esc(b.levels)}</span>
          <b class="book__name">${esc(b.name)}</b>
          <span class="book__ja" lang="ja">${jp(b.ja, { hl: false })}</span>
          <span class="book__blurb">${esc(b.blurb)}</span>
          <span class="book__foot">${D ? `<span><b>${D.units.length}</b> ${b.unitName === "Bài" ? "bài" : "Unit"} · <b>${fmt(items.length)}</b> mục</span><span>${k ? `đã học ${fmt(k)}` : "chưa học"}</span>${meter(k, items.length)}`
            : `<span><b>${b.units}</b> ${b.unitName === "Bài" ? "bài" : "Unit"}</span><span class="pill pill--soon">Đang biên soạn</span>`}</span></span></a></li>`;
    }).join("");
    main.innerHTML = band({ big: "教科書", bigJp: true, title: "Học theo giáo trình", text: "Chọn đúng cuốn sách bạn đang học. Từ vựng đi theo thứ tự từng bài, từng Unit của sách, với đủ học thẻ, trắc nghiệm, viết lại, ghép cặp, tải về Anki và lộ trình ôn tự động sau 1, 3, 7, 14, 30 ngày.",
      meta: `<b>${list.length}</b><span>giáo trình</span>` }) +
      `<section class="sec"><div class="wrap"><ul class="books">${cards}</ul>
        <p class="gt-note">Minh Dokkai chỉ dùng danh sách từ và thứ tự bài của giáo trình để sắp xếp. Cụm từ, câu ví dụ và bản dịch là nội dung riêng của Minh Dokkai, không sao chép từ sách. Hãy dùng kèm sách gốc để có bài nghe và bài tập đầy đủ.</p>
      </div></section>`;
    current = { refresh: books };
  }

  async function book(id) {
    const b = (C.books || []).find(x => x.id === id); if (!b) return notFound();
    if (!b.ready) {
      main.innerHTML = band({ big: b.id === "minna" ? "みんな" : "耳", bigJp: true, crumb: "Tất cả giáo trình", crumbHref: "#/giao-trinh", title: esc(b.name), text: esc(b.blurb),
        meta: `<b>${b.units}</b><span>${b.unitName === "Bài" ? "bài" : "Unit"}, đang biên soạn</span>` }) +
        `<section class="sec"><div class="wrap"><div class="empty"><h3>Giáo trình này đang được sắp xếp</h3>
          <p>Khi hoàn thành, mỗi ${b.unitName === "Bài" ? "bài" : "Unit"} sẽ có đủ bốn chế độ luyện. Trong lúc chờ, bạn có thể học theo chủ đề JLPT.</p>
          <a class="btn btn--primary" href="#/giao-trinh">Chọn giáo trình khác</a></div></div></section>`;
      current = { refresh: () => book(id) };
      return;
    }
    const G = await loadBooks();
    const D = bookData(G, id); if (!D) return notFound();
    const all = D.units.flatMap(unitItems), k = learnedIn(all);
    const next = D.units.find(u => !gtRec(id, u.n) && unitItems(u).length) || null;
    const dueU = D.units.map(u => ({ u, st: gtState(id, u) })).filter(x => x.st.s === "due").sort((a, b2) => b2.st.late - a.st.late);
    const passed = D.units.filter(u => gtRec(id, u.n)), solid = passed.filter(u => gtState(id, u).s === "solid");
    const upcoming = D.units.map(u => ({ u, st: gtState(id, u) })).filter(x => x.st.s === "wait").sort((a, b2) => a.st.left - b2.st.left)[0];
    const rvN = all.filter(e => P.rv[e.id]).length;
    const uName = b.unitName === "Bài" ? "bài" : "Unit";
    const plan = `<section class="sec plan-sec"><div class="wrap">
      <div class="sec__head"><h2>Hôm nay học gì</h2><p class="sec__lead">Lộ trình đi theo đúng thứ tự ${uName} của sách. Học thẻ xong, làm trắc nghiệm hoặc viết lại đạt từ 80% là hoàn thành ${uName}; ${uName} đó tự được xếp lịch ôn sau 1, 3, 7, 14 và 30 ngày.</p></div>
      <div class="plan">
        <div class="plan__c plan__c--new"><span class="plan__k">Học mới</span>${next ? `<b>${esc(unitLabel(b, next))}</b><span>${unitItems(next).length} mục${next.vi && (b.unitName !== "Bài" || !/^\d+$/.test(next.n)) ? ` · ${esc(next.vi)}` : ""}</span><a class="btn btn--mint btn--sm" href="#/giao-trinh/${id}/${encodeURIComponent(next.n)}">${passed.length ? "Học tiếp" : "Bắt đầu"}</a>` : `<b>Đã học hết ${D.units.length} ${uName}</b><span>Giờ chỉ còn ôn theo lịch.</span>`}</div>
        <div class="plan__c plan__c--due"><span class="plan__k">Đến hạn ôn</span>${dueU.length ? `<b>${dueU.length} ${uName}</b><ul class="plan__list">${dueU.slice(0, 6).map(x => `<li><a href="#/giao-trinh/${id}/${encodeURIComponent(x.u.n)}">${esc(unitLabel(b, x.u))}<small>lượt ${x.st.k}${x.st.late ? `, trễ ${x.st.late} ngày` : ""}</small></a></li>`).join("")}</ul>${dueU.length > 6 ? `<span>và ${dueU.length - 6} ${uName} khác bên dưới</span>` : ""}<a class="btn btn--coral btn--sm" href="#/giao-trinh/${id}/${encodeURIComponent(dueU[0].u.n)}">Ôn ${esc(unitLabel(b, dueU[0].u))}</a>`
          : `<b>Không có</b><span>${upcoming ? `Lượt gần nhất: ${esc(unitLabel(b, upcoming.u))}, ${upcoming.st.left === 1 ? "ngày mai" : `sau ${upcoming.st.left} ngày`}.` : `Hoàn thành ${uName} đầu tiên để có lịch ôn.`}</span>`}</div>
        <div class="plan__c"><span class="plan__k">Ôn tích lũy</span><b>${passed.length} ${uName} đã học</b><span>${passed.length ? `Trộn ngẫu nhiên tối đa 40 từ, ưu tiên từ đang cần ôn.${solid.length ? ` ${solid.length} ${uName} đã vững.` : ""}` : "Mở khi bạn hoàn thành ít nhất một " + uName + "."}</span>${passed.length ? `<a class="btn btn--ghost btn--sm" href="#/giao-trinh/${id}/on-tap">Ôn ngẫu nhiên</a>` : ""}</div>
        <div class="plan__c"><span class="plan__k">Từ cần ôn</span><b>${rvN} mục</b><span>Từ bấm “Chưa thuộc” hoặc làm sai, chỉ tính trong sách này.</span>${rvN ? `<a class="btn btn--ghost btn--sm" href="#/giao-trinh/${id}/can-on">Ôn ngay</a>` : ""}</div>
      </div></div></section>`;
    const tile = u => {
      const its = unitItems(u), n = learnedIn(its), gs = gtState(id, u), done = gs.s === "solid" || gs.s === "wait" || gs.s === "due";
      return `<li><a class="lesson${done ? " lesson--done" : ""}${u === next ? " lesson--next" : ""}${gs.s === "due" ? " lesson--due" : ""}" href="#/giao-trinh/${id}/${encodeURIComponent(u.n)}">${gtLabel(gs) && gs.s !== "doing" ? `<span class="lesson__st lesson__st--${gs.s}">${esc(gtLabel(gs))}</span>` : ""}
        <span class="lesson__no">${esc(unitCode(D, u))}</span>
        <span class="lesson__t">${esc(unitLabel(b, u))}${u.vi && /^\d+$/.test(u.n) && b.unitName !== "Bài" ? `<small>${esc(u.vi)}</small>` : !/^\d+$/.test(u.n) ? `<small>${esc(u.vi)}</small>` : ""}</span>
        <span class="lesson__n">${its.length} mục${n ? ` · đã học ${n}` : ""}</span>${meter(n, its.length)}</a></li>`;
    };
    // Minna: chia nhóm N5 (bài 1–25) và N4 (bài 26–50); Mimikara: một nhóm
    const groups = [];
    D.units.forEach(u => { const g = groups.find(x => x.lv === u.lv); if (g) g.units.push(u); else groups.push({ lv: u.lv, units: [u] }); });
    const many = groups.length > 1;
    main.innerHTML = band({ big: b.id === "minna" ? "みんな" : "耳", bigJp: true, crumb: "Tất cả giáo trình", crumbHref: "#/giao-trinh", title: esc(b.name),
        text: esc(b.blurb),
        extra: `<div class="hero__actions" style="margin-top:16px">${dueU.length ? `<a class="btn btn--mint" href="#/giao-trinh/${id}/${encodeURIComponent(dueU[0].u.n)}">Ôn: ${esc(unitLabel(b, dueU[0].u))}</a>` : ""}${next ? `<a class="btn ${dueU.length ? "btn--ghost-l" : "btn--mint"}" href="#/giao-trinh/${id}/${encodeURIComponent(next.n)}">${passed.length ? "Học tiếp" : "Bắt đầu"}: ${esc(unitLabel(b, next))}</a>` : ""}</div>`,
        meta: `<b>${passed.length} / ${D.units.length}</b><span>${uName} đã hoàn thành</span>${meter(passed.length, D.units.length)}<span class="band__sub">${fmt(k)} / ${fmt(all.length)} mục đã học</span>` }) + plan +
      `<section class="sec"><div class="wrap">${groups.map(g => `
        ${many ? `<div class="sec__head" style="margin-top:8px"><h2>${lvtag(g.lv)} ${b.unitName} ${esc(g.units[0].n)}–${esc(g.units[g.units.length - 1].n)}</h2></div>` : `<div class="sec__head"><h2>${D.units.length} phần theo thứ tự sách</h2><p class="sec__lead">Mỗi phần giữ nguyên thứ tự từ trong sách. Thẻ có cụm từ, âm Hán Việt và câu ví dụ riêng của Minh Dokkai.</p></div>`}
        <ol class="lessons">${g.units.map(tile).join("")}</ol>`).join("")}
      </div></section>`;
    current = { refresh: () => book(id) };
  }

  async function bookUnit(id, n) {
    const b = (C.books || []).find(x => x.id === id); if (!b || !b.ready) return notFound();
    const G = await loadBooks();
    const D = bookData(G, id); if (!D) return notFound();
    const i = D.units.findIndex(u => u.n === n); if (i < 0) return notFound();
    const u = D.units[i], items = unitItems(u);
    if (!items.length) return notFound();
    const prev = D.units[i - 1], next = D.units[i + 1];
    const link = (x, dir) => x ? `<a class="unitnav__a" href="#/giao-trinh/${id}/${encodeURIComponent(x.n)}">${dir < 0 ? "← " : ""}${esc(unitLabel(b, x))}${dir > 0 ? " →" : ""}</a>` : "<span></span>";
    const gs = gtState(id, u), uName = b.unitName === "Bài" ? "bài" : "Unit";
    const step = gs.s === "due" ? `<b>Đến hạn ôn lượt ${gs.k}.</b> Làm trắc nghiệm hoặc viết lại, đạt từ 80% là xong lượt ôn này.`
      : gs.s === "wait" ? `<b>Đã hoàn thành.</b> ${gtLabel(gs)}. Bạn vẫn có thể luyện thêm bất cứ lúc nào.`
      : gs.s === "solid" ? `<b>Đã vững.</b> ${uName} này đã qua đủ ${GT_GAPS.length} lượt ôn.`
      : `<b>Bước 1:</b> học thẻ. <b>Bước 2:</b> trắc nghiệm hoặc viết lại, đạt từ 80% là hoàn thành ${uName} và mở lịch ôn.`;
    study({ mode: gs.s === "due" ? "quiz" : "card", onResult: (m, r, t) => { gtResult(b, u)(m, r, t); }, title: `${b.short} · ${unitLabel(b, u)}`, titleJa: /^\d+$/.test(u.n) && b.unitName === "Bài" ? `第[だい]${u.n}課[か]` : "",
      sub: `${u.vi && b.unitName !== "Bài" ? u.vi + ". " : !/^\d+$/.test(u.n) ? u.vi + ". " : ""}${items.length} mục, giữ đúng thứ tự trong sách.`,
      crumb: b.name, crumbHref: `#/giao-trinh/${id}`, items, file: `minh-dokkai-${id}-${String(u.n).toLowerCase()}`,
      extra: `<p class="unitplan">${step}</p><nav class="unitnav" aria-label="Chuyển bài">${link(prev, -1)}${link(next, 1)}</nav>` });
  }

  async function bookReview(id, kind) {
    const b = (C.books || []).find(x => x.id === id); if (!b || !b.ready) return notFound();
    const G = await loadBooks();
    const D = bookData(G, id); if (!D) return notFound();
    const uName = b.unitName === "Bài" ? "bài" : "Unit";
    let items, title, sub;
    if (kind === "rv") {
      const seen = new Set(); items = D.units.flatMap(unitItems).filter(e => P.rv[e.id] && !seen.has(e.id) && seen.add(e.id));
      title = `${b.short} · Từ cần ôn`; sub = `${items.length} mục bạn chưa thuộc trong sách này.`;
    } else {
      const pool = [...new Map(gtPassedItems(id, D).map(e => [e.id, e])).values()];
      const weak = shuffle(pool.filter(e => P.rv[e.id])), rest = shuffle(pool.filter(e => !P.rv[e.id]));
      items = weak.concat(rest).slice(0, 40);
      title = `${b.short} · Ôn tích lũy`; sub = `${items.length} từ trộn từ ${D.units.filter(u => gtRec(id, u.n)).length} ${uName} đã học. Mở lại trang để có bộ từ khác.`;
    }
    if (!items.length) { location.hash = `#/giao-trinh/${id}`; return; }
    study({ mode: kind === "mix" ? "quiz" : "card", title, sub, crumb: b.name, crumbHref: `#/giao-trinh/${id}`, items, file: `minh-dokkai-${id}-${kind === "rv" ? "can-on" : "on-tich-luy"}` });
  }

  /* ------------------------------------------------------------ cần ôn */
  const reviewPool = async () => {
    await loadAll(); let all = allItems();
    if (C.industriesReady) { const D = await load("nganh"); all = all.concat(D.topics.flatMap(t => t.items)); }
    // từ đánh dấu khi học theo giáo trình có thể thuộc cấp chưa mở hoặc là mục riêng của giáo trình
    if (booksReady().length) {
      await loadBooks().catch(() => null);
      if (BOOKIDX) { const seen = new Set(all.map(e => e.id)); BOOKIDX.forEach(e => { if (!seen.has(e.id)) all.push(e); }); }
    }
    return all.filter(e => P.rv[e.id]);
  };
  async function review() {
    const items = await reviewPool();
    main.innerHTML = band({ big: "復習", bigJp: true, title: "Danh sách cần ôn", text: "Mọi từ bạn đánh dấu “Chưa thuộc” hoặc trả lời sai, gom từ tất cả các gói. Trả lời đúng hoặc bấm “Đã học” là từ rời khỏi danh sách.",
      meta: `<b>${items.length}</b><span>mục cần ôn</span>` }) +
      `<section class="sec" style="padding-top:32px"><div class="wrap">${items.length ? `
        <div class="toolbar"><a class="btn btn--primary" href="#/on-tap/hoc">Ôn ${items.length} mục này</a><span class="grow"></span><button class="btn btn--ghost btn--sm" type="button" data-clear>Xóa toàn bộ danh sách</button></div>
        <table class="vt"><thead><tr><th>Cấp</th><th>Từ</th><th>Nghĩa</th><th>Cụm từ</th></tr></thead><tbody>${items.map(e => `<tr><td>${lvtag(e.lv)}</td>
          <td><span class="jp" lang="ja">${jp(e.w, { hl: false })}</span></td><td>${esc(e.vi)}</td>
          <td>${e.c ? `<span class="col-c" lang="ja">${jp(e.c, { hl: false })}</span><div class="muted">${esc(e.cv)}</div>` : ""}</td></tr>`).join("")}</tbody></table>` :
        `<div class="empty"><h3>Chưa có từ nào cần ôn</h3><p>Khi học thẻ, bấm “Chưa thuộc” để đưa từ vào đây. Các câu trắc nghiệm hay ghép cặp làm sai cũng tự động được thêm.</p><a class="btn btn--primary" href="#/n5">Bắt đầu học N5</a></div>`}
      </div></section>`;
    const c = $("[data-clear]");
    if (c) c.onclick = () => { if (confirm("Xóa toàn bộ danh sách cần ôn? Tiến độ “đã học” vẫn được giữ.")) { P.rv = {}; P.clr = nowSec(); saveP(); review(); } };
    current = { refresh: review };
  }
  async function reviewStudy() {
    const items = await reviewPool();
    if (!items.length) { location.hash = "#/on-tap"; return; }
    study({ title: "Ôn các từ chưa thuộc", sub: `${items.length} mục từ nhiều gói khác nhau.`, crumb: "Danh sách cần ôn", crumbHref: "#/on-tap", items, file: "minh-dokkai-can-on" });
  }

  /* ------------------------------------------------------------ chủ đề màu */
  const THEMES = [
    { id: "reu", ja: "苔", name: "Rêu", note: "Xanh rêu, mặc định", c: ["#004646", "#27c4b5", "#ed3838", "#f7f4ed"], meta: "#004646" },
    { id: "ai", ja: "藍", name: "Chàm", note: "Xanh chàm, dịu mắt", c: ["#233a63", "#5fa8d8", "#e0533d", "#f1f3f7"], meta: "#233a63" },
    { id: "sakura", ja: "桜", name: "Anh đào", note: "Hồng mận, ấm áp", c: ["#7a2e4a", "#ee8fae", "#d23b3b", "#fbf1f2"], meta: "#7a2e4a" },
    { id: "matcha", ja: "抹茶", name: "Trà xanh", note: "Xanh lá, tự nhiên", c: ["#3f5a22", "#a3c45a", "#d9622b", "#f4f2e4"], meta: "#3f5a22" },
    { id: "momiji", ja: "紅葉", name: "Lá phong", note: "Nâu đỏ mùa thu", c: ["#7a2f14", "#f2a04a", "#c8102e", "#faf0e3"], meta: "#7a2f14" },
    { id: "yoru", ja: "夜", name: "Ban đêm", note: "Nền tối, học buổi tối", c: ["#0b1416", "#134e4c", "#3fd1c0", "#ff6b6b"], meta: "#0b1416" }
  ];
  function applyTheme(id) {
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    if (t.id === "reu") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t.id;
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute("content", t.meta);
    $$(".theme-opt").forEach(o => o.setAttribute("aria-checked", o.dataset.t === t.id));
  }
  (function themePicker() {
    const btn = $("[data-theme-btn]"), menu = $(".theme-menu");
    menu.innerHTML = "<p>Màu giao diện</p>" + THEMES.map(t => `<button class="theme-opt" type="button" role="menuitemradio" data-t="${t.id}" aria-checked="false">
      <span class="sw">${t.c.map(c => `<i style="background:${c}"></i>`).join("")}</span>
      <span><b>${t.name}</b><small>${t.note}</small></span><span class="ja" lang="ja">${t.ja}</span></button>`).join("");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", ev => { ev.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", open); });
    menu.addEventListener("click", ev => {
      const o = ev.target.closest(".theme-opt"); if (!o) return;
      S.theme = o.dataset.t; saveS(); applyTheme(S.theme); close();
      toast(`Đã đổi sang màu ${THEMES.find(x => x.id === S.theme).name}`);
    });
    document.addEventListener("click", ev => { if (!ev.target.closest(".themes")) close(); });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape") close(); });
    applyTheme(S.theme || "reu");
  })();

  /* ------------------------------------------------------------ bật tắt */
  function paintToggles() {
    $$("[data-toggle]").forEach(b => b.setAttribute("aria-pressed", !!S[b.dataset.toggle]));
  }
  function flip(key) {
    S[key] = !S[key]; saveS(); paintToggles();
    toast(key === "kanji" ? (S.kanji ? "Đang hiện Kanji kèm furigana" : "Đang hiện bằng hiragana") : key === "furi" ? (S.furi ? "Đang hiện furigana" : "Đã ẩn furigana — chỉ hiện Kanji") : (S.romaji ? "Đang hiện romaji" : "Đã ẩn romaji"));
    if (current && current.refresh) current.refresh(); else route();
  }
  $$("[data-toggle]").forEach(b => b.addEventListener("click", () => flip(b.dataset.toggle)));
  document.addEventListener("keydown", ev => {
    if (ev.target.matches("input, textarea") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === "k" || ev.key === "K") flip("kanji");
    if (ev.key === "f" || ev.key === "F") flip("furi");
    if (ev.key === "r" || ev.key === "R") flip("romaji");
  });

  /* ------------------------------------------------------------ cầu nối với assets/auth.js (đăng nhập + đồng bộ) */
  window.MD.sync = {
    snapshot: () => ({ progress: JSON.parse(JSON.stringify(P)), placement: store.get("placement", null) }),
    onChange: fn => listeners.push(fn),
    toast,
    apply(blob) {   // ghi tiến độ đã gộp vào thiết bị; không kích hoạt đồng bộ ngược
      const before = JSON.stringify([P, store.get("placement", null)]);
      const p = (blob && blob.progress) || {};
      P.ok = p.ok || {}; P.rv = p.rv || {}; P.gt = p.gt || {}; P.clr = p.clr || 0;
      store.set("progress", P);
      if (blob && blob.placement) store.set("placement", blob.placement); else { try { localStorage.removeItem("md:placement"); } catch (e) { /* bỏ qua */ } }
      paintReviewBadge();
      if (JSON.stringify([P, store.get("placement", null)]) !== before && !(current && current.destroy)) route();
    }
  };

  paintToggles();
  paintReviewBadge();
  window.addEventListener("hashchange", route);
  route();
})();
