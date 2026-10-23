/* Minh Dokkai — tài khoản và đồng bộ tiến độ.
   Có hai chế độ, tự chọn khi mở hộp thoại đăng nhập:
   - "remote": dùng máy chủ /api (Vercel Functions + Upstash Redis), tiến độ theo tài khoản trên mọi thiết bị.
   - "local" : khi chưa có máy chủ (mở file, hosting tĩnh, chưa cấu hình DB), tài khoản chỉ nằm trong trình duyệt này.
   Tiến độ luôn lưu trên thiết bị trước; tài khoản chỉ gộp thêm và sao lưu. Gộp theo dấu thời gian từng từ nên không mất dữ liệu. */
(() => {
  "use strict";
  const SYNC = window.MD && window.MD.sync;
  if (!SYNC) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("md:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("md:" + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem("md:" + k); } catch (e) { /* bỏ qua */ } }
  };
  const toast = m => SYNC.toast(m);
  class Fail extends Error { constructor(msg, code) { super(msg); this.code = code; } }

  /* ---------------------------------------------------------- gộp tiến độ giữa hai bản */
  function merge(a, b) {
    if (!b) return a;
    if (!a) return b;
    const pa = a.progress || {}, pb = b.progress || {};
    const clr = Math.max(pa.clr || 0, pb.clr || 0);          // mốc lần xóa danh sách cần ôn
    const out = { ok: {}, rv: {}, gt: {}, clr };
    const ids = new Set([...Object.keys(pa.ok || {}), ...Object.keys(pa.rv || {}), ...Object.keys(pb.ok || {}), ...Object.keys(pb.rv || {})]);
    for (const id of ids) {
      let best = null;
      for (const [st, t] of [["ok", (pa.ok || {})[id]], ["rv", (pa.rv || {})[id]], ["ok", (pb.ok || {})[id]], ["rv", (pb.rv || {})[id]]]) {
        if (!t) continue;
        if (!best || t > best.t || (t === best.t && st === "rv")) best = { st, t };   // mới nhất thắng; bằng nhau thì ưu tiên "cần ôn"
      }
      if (!best || (best.st === "rv" && best.t <= clr)) continue;
      out[best.st][id] = best.t;
    }
    for (const side of [pa.gt || {}, pb.gt || {}]) {
      for (const [bid, units] of Object.entries(side)) {
        const box = out.gt[bid] = out.gt[bid] || {};
        for (const [n, r] of Object.entries(units || {})) {
          const c = box[n];
          if (!c || r.st > c.st || (r.st === c.st && r.t > c.t)) box[n] = r;           // lượt ôn cao hơn / mới hơn thắng
        }
      }
    }
    const placement = [a.placement, b.placement].filter(Boolean).sort((x, y) => y.at - x.at)[0] || null;
    return { progress: out, placement };
  }

  /* ---------------------------------------------------------- hai kiểu máy chủ */
  const valid = (email, password) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Fail("Email chưa đúng định dạng.");
    if (password.length < 8) throw new Fail("Mật khẩu cần ít nhất 8 ký tự.");
  };

  const remote = {
    mode: "remote",
    async call(method, body, token) {
      let res;
      try {
        res = await fetch("/api/" + (body && body.path || "auth"), {
          method, cache: "no-store", keepalive: !!(body && body.keepalive),
          headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
          body: body && body.json ? JSON.stringify(body.json) : undefined
        });
      } catch (e) { throw new Fail("Không kết nối được máy chủ. Hãy kiểm tra mạng.", "net"); }
      let j = null; try { j = await res.json(); } catch (e) { /* không phải JSON */ }
      if (res.status === 401) throw new Fail((j && j.error) || "Phiên đăng nhập đã hết hạn.", "auth");
      if (!res.ok) throw new Fail((j && j.error) || "Máy chủ báo lỗi, hãy thử lại sau.", "http");
      return j || {};
    },
    async register(email, password, name) { valid(email, password); return this.call("POST", { json: { action: "register", email, password, name } }); },
    async login(email, password) { return this.call("POST", { json: { action: "login", email, password } }); },
    async pull(s) { const j = await this.call("GET", { path: "progress" }, s.token); return { data: j.data || null, rev: j.rev || 0 }; },
    async push(s, data) {
      const j = await this.call("PUT", { path: "progress", json: { data, ifRev: s.rev }, keepalive: JSON.stringify(data).length < 55000 }, s.token);
      return { ok: !!j.ok, rev: j.rev };
    }
  };

  const enc = new TextEncoder();
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  async function pbkdf2(password, saltHex) {
    if (!(window.crypto && crypto.subtle)) throw new Fail("Trình duyệt này không hỗ trợ tạo tài khoản trên thiết bị (cần https hoặc localhost).");
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256));
  }
  const local = {
    mode: "local",
    async register(email, password, name) {
      valid(email, password);
      const all = LS.get("accounts", {}), id = email.toLowerCase();
      if (all[id]) throw new Fail("Email này đã có tài khoản trên thiết bị. Hãy đăng nhập.");
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      all[id] = { email: id, name: name || id.split("@")[0], salt, hash: await pbkdf2(password, salt) };
      LS.set("accounts", all);
      return { token: "local", user: { email: id, name: all[id].name } };
    },
    async login(email, password) {
      const a = LS.get("accounts", {})[email.toLowerCase()];
      if (!a || (await pbkdf2(password, a.salt)) !== a.hash) throw new Fail("Email hoặc mật khẩu không đúng.");
      return { token: "local", user: { email: a.email, name: a.name } };
    },
    async pull(s) { const r = LS.get("acct:" + s.email, null); return r ? { data: r.data, rev: r.rev } : { data: null, rev: 0 }; },
    async push(s, data) {
      const cur = LS.get("acct:" + s.email, { rev: 0 });
      if (cur.rev !== s.rev) return { ok: false, rev: cur.rev };
      LS.set("acct:" + s.email, { data, rev: cur.rev + 1 });
      return { ok: true, rev: cur.rev + 1 };
    }
  };

  let probe = null;   // kết quả dò máy chủ, giữ trong phiên
  function detect() {
    if (probe) return probe;
    probe = (async () => {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
        const res = await fetch("/api/auth", { cache: "no-store", signal: ctl.signal }); clearTimeout(t);
        const j = await res.json();
        if (j && j.ok && j.ready) return { backend: remote, why: "" };
        if (j && j.ok) {
          const T = { db_url: "chưa có địa chỉ cơ sở dữ liệu (KV_REST_API_URL)", db_token: "chưa có khóa cơ sở dữ liệu (KV_REST_API_TOKEN)", secret_missing: "chưa đặt biến AUTH_SECRET", secret_short: "AUTH_SECRET ngắn hơn 16 ký tự" };
          const m = (j.missing || []).map(k => T[k] || k);
          return { backend: local, why: "Máy chủ chưa cấu hình xong" + (m.length ? ": " + m.join("; ") : "") + "." };
        }
      } catch (e) { /* hosting tĩnh hoặc mất mạng */ }
      return { backend: local, why: "" };
    })();
    return probe;
  }

  /* ---------------------------------------------------------- phiên và đồng bộ */
  let session = LS.get("auth", null);     // { mode, token, email, name, rev }
  const B = () => session.mode === "remote" ? remote : local;
  const saveSession = () => session ? LS.set("auth", session) : LS.del("auth");
  let status = "idle", lastOk = 0, timer = null, firstChange = 0, busy = false, again = false;

  function setStatus(s) { status = s; if (s === "ok") lastOk = Date.now(); paintBtn(); paintMenu(); }

  async function sync(first) {
    if (!session) return;
    if (busy) { again = true; return; }
    busy = true; setStatus("syncing");
    try {
      let snap = SYNC.snapshot();
      if (first) {
        const r = await B().pull(session);
        session.rev = r.rev;
        snap = merge(snap, r.data); SYNC.apply(snap);
      }
      for (let n = 0; n < 4; n++) {
        const r = await B().push(session, snap);
        if (r.ok) { session.rev = r.rev; saveSession(); setStatus("ok"); break; }
        const p = await B().pull(session);                   // người khác (thiết bị khác) vừa ghi: gộp rồi thử lại
        session.rev = p.rev;
        snap = merge(SYNC.snapshot(), p.data); SYNC.apply(snap);
        if (n === 3) throw new Fail("Không đồng bộ được, sẽ thử lại sau.", "http");
      }
    } catch (e) {
      if (e.code === "auth") { expire(); }
      else setStatus(e.code === "net" ? "offline" : "error");
    } finally {
      busy = false;
      if (again) { again = false; queue(); }
    }
  }
  function queue() {
    if (!session) return;
    firstChange = firstChange || Date.now();
    clearTimeout(timer);
    const wait = Math.max(300, Math.min(2500, 15000 - (Date.now() - firstChange)));   // gom thay đổi, tối đa chờ 15 giây
    timer = setTimeout(() => { firstChange = 0; sync(false); }, wait);
    if (status !== "syncing") setStatus("pending");
  }
  SYNC.onChange(queue);
  window.addEventListener("online", () => session && sync(true));
  document.addEventListener("visibilitychange", () => {
    if (!session) return;
    if (document.visibilityState === "hidden" && timer) { clearTimeout(timer); timer = null; firstChange = 0; sync(false); }
    else if (document.visibilityState === "visible" && Date.now() - lastOk > 120000) sync(true);
  });

  function expire() {
    session = null; saveSession(); setStatus("idle");
    toast("Phiên đăng nhập đã hết hạn. Tiến độ vẫn ở trên thiết bị, hãy đăng nhập lại để đồng bộ.");
  }

  async function signOut() {
    if (busy) await new Promise(r => setTimeout(r, 600));
    clearTimeout(timer); timer = null;
    await sync(false);
    if (status === "offline" || status === "error") {
      if (!confirm("Còn thay đổi chưa lưu lên tài khoản (đang mất mạng hoặc máy chủ lỗi). Đăng xuất bây giờ sẽ mất các thay đổi đó. Vẫn đăng xuất?")) return;
    } else if (!confirm("Đăng xuất khỏi " + session.email + "?\nTiến độ đã lưu trong tài khoản. Bản trên thiết bị này sẽ được xóa để người khác dùng máy không thấy.")) return;
    session = null; saveSession();
    SYNC.apply({ progress: {}, placement: null });
    closeMenu(); setStatus("idle");
    toast("Đã đăng xuất");
  }

  /* ---------------------------------------------------------- nút trên đầu trang */
  const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg>';
  const btn = $("[data-acct]");
  const initial = () => (session.name || session.email || "?").trim().charAt(0).toUpperCase();
  const STATUS = { idle: "", ok: "Đã đồng bộ", syncing: "Đang lưu…", pending: "Đang lưu…", offline: "Mất mạng, sẽ lưu lại khi có mạng", error: "Lưu chưa được, sẽ thử lại" };
  function paintBtn() {
    if (!btn) return;
    if (!session) {
      btn.innerHTML = `<span class="acct-av acct-av--out">${ICON_USER}</span><span class="lbl">Đăng nhập</span>`;
      btn.title = "Đăng nhập để lưu tiến độ"; btn.setAttribute("aria-haspopup", "dialog");
      return;
    }
    btn.innerHTML = `<span class="acct-av">${esc(initial())}<i class="acct-dot acct-dot--${status}"></i></span><span class="lbl">${esc(session.name || session.email)}</span>`;
    btn.title = `${session.email} — ${STATUS[status] || ""}`; btn.setAttribute("aria-haspopup", "menu");
  }

  let menu = null;
  function paintMenu() {
    if (!menu) return;
    const st = $("[data-st]", menu); if (st) st.textContent = STATUS[status] || (lastOk ? "Đã đồng bộ" : "");
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; btn.setAttribute("aria-expanded", "false"); } }
  function openMenu() {
    closeMenu();
    menu = document.createElement("div");
    menu.className = "acct-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML = `<div class="acct-menu__who"><b>${esc(session.name || session.email)}</b><span>${esc(session.email)}</span></div>
      <p class="acct-menu__st"><i class="acct-dot acct-dot--${status}"></i><span data-st></span></p>
      ${session.mode === "local" ? '<p class="acct-menu__note">Tài khoản trên thiết bị này, chưa đồng bộ sang máy khác.</p>' : ""}
      <button type="button" role="menuitem" data-now>Đồng bộ ngay</button>
      <button type="button" role="menuitem" data-out>Đăng xuất</button>`;
    btn.parentElement.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    paintMenu();
    $("[data-now]", menu).onclick = () => { sync(true); };
    $("[data-out]", menu).onclick = signOut;
  }
  document.addEventListener("click", ev => { if (menu && !ev.target.closest(".acct")) closeMenu(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeMenu(); });
  if (btn) btn.addEventListener("click", ev => {
    ev.stopPropagation();
    if (session) { menu ? closeMenu() : openMenu(); } else openDialog();
  });

  /* ---------------------------------------------------------- hộp thoại đăng nhập */
  let dlg = null;
  async function openDialog(tab) {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "auth"; dlg.setAttribute("aria-labelledby", "auth-title");
      document.body.appendChild(dlg);
      dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    }
    let mode = tab || "login", busyForm = false;
    const det = await detect();
    const draw = (err) => {
      const reg = mode === "register";
      dlg.innerHTML = `<div class="auth__in">
        <button class="auth__x" type="button" data-x aria-label="Đóng">×</button>
        <h2 id="auth-title">${reg ? "Tạo tài khoản" : "Đăng nhập"}</h2>
        <p class="auth__lead">Lưu tiến độ học, danh sách từ cần ôn và lịch ôn theo giáo trình. ${det.backend === remote ? "Dùng được trên mọi thiết bị." : ""}</p>
        ${det.backend === local ? `<p class="auth__note"><b>Chế độ trên thiết bị.</b> ${esc(det.why || "Chưa kết nối máy chủ.")} Tài khoản và tiến độ chỉ lưu trong trình duyệt này, chưa đồng bộ sang máy khác.</p>` : ""}
        <div class="auth__tabs" role="tablist">
          <button type="button" role="tab" aria-selected="${!reg}" data-tab="login">Đăng nhập</button>
          <button type="button" role="tab" aria-selected="${reg}" data-tab="register">Tạo tài khoản</button>
        </div>
        <form class="auth__form" novalidate>
          ${reg ? '<label>Tên hiển thị <small>(không bắt buộc)</small><input name="name" autocomplete="nickname" maxlength="40"></label>' : ""}
          <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
          <label>Mật khẩu${reg ? " <small>(ít nhất 8 ký tự)</small>" : ""}<span class="pw"><input name="password" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required minlength="8"><button type="button" data-eye aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></span></label>
          <p class="auth__err" role="alert">${esc(err || "")}</p>
          <button class="btn btn--primary auth__go" type="submit">${reg ? "Tạo tài khoản và lưu tiến độ" : "Đăng nhập"}</button>
          <p class="auth__fine">Chúng tôi chỉ lưu email, tên hiển thị và tiến độ học của bạn. Tiến độ đang có trên thiết bị này sẽ được gộp vào tài khoản.${reg ? " Hiện chưa có chức năng khôi phục mật khẩu qua email, hãy nhớ mật khẩu của bạn." : ""}</p>
        </form></div>`;
      $("[data-x]", dlg).onclick = () => dlg.close();
      $$("[data-tab]", dlg).forEach(b => b.onclick = () => { mode = b.dataset.tab; draw(); focusFirst(); });
      $("[data-eye]", dlg).onclick = ev => {
        const i = $("input[name=password]", dlg), show = i.type === "password";
        i.type = show ? "text" : "password"; ev.currentTarget.textContent = show ? "Ẩn" : "Hiện"; ev.currentTarget.setAttribute("aria-pressed", show);
      };
      $("form", dlg).addEventListener("submit", submit);
    };
    const focusFirst = () => { const i = $("input", dlg); if (i) i.focus(); };
    async function submit(ev) {
      ev.preventDefault();
      if (busyForm) return;
      const f = ev.currentTarget, email = f.email.value.trim(), password = f.password.value, name = f.name ? f.name.value.trim() : "";
      const go = $(".auth__go", dlg), errEl = $(".auth__err", dlg);
      errEl.textContent = "";
      busyForm = true; go.disabled = true; go.textContent = "Đang xử lý…";
      try {
        const r = mode === "register" ? await det.backend.register(email, password, name) : await det.backend.login(email, password);
        session = { mode: det.backend.mode, token: r.token, email: r.user.email, name: r.user.name || "", rev: 0 };
        saveSession(); dlg.close();
        paintBtn(); toast(mode === "register" ? "Đã tạo tài khoản. Đang lưu tiến độ…" : "Đã đăng nhập. Đang đồng bộ tiến độ…");
        await sync(true);
        if (status === "ok") toast("Đã đồng bộ tiến độ với tài khoản");
      } catch (e) {
        busyForm = false; go.disabled = false; go.textContent = mode === "register" ? "Tạo tài khoản và lưu tiến độ" : "Đăng nhập";
        errEl.textContent = e instanceof Fail ? e.message : "Có lỗi xảy ra, hãy thử lại.";
        if (!(e instanceof Fail)) console.error(e);
      }
    }
    draw();
    if (!dlg.open) dlg.showModal();
    focusFirst();
  }

  /* ---------------------------------------------------------- khởi động */
  window.MD.openLogin = openDialog;
  $$("[data-open-login]").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); if (!session) openDialog(); }));
  paintBtn();
  if (session) setTimeout(() => sync(true), 400);
})();
