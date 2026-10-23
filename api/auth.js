/* GET  /api/auth  -> {ok, ready}      (để trang web biết đã có máy chủ chưa)
   POST /api/auth  {action:"register"|"login", email, password, name} -> {token, user} */
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return L.send(res, 200, { ok: true, ready: L.ready() });
    if (req.method !== "POST") return L.send(res, 405, { error: "Phương thức không hợp lệ." });
    if (!L.ready()) return L.send(res, 503, { error: "Máy chủ chưa được cấu hình." });

    const b = await L.body(req);
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    const name = String(b.name || "").trim().slice(0, 40);
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return L.send(res, 400, { error: "Email chưa đúng định dạng." });
    if (password.length < 8 || password.length > 200) return L.send(res, 400, { error: "Mật khẩu cần từ 8 đến 200 ký tự." });
    const uid = L.userId(email);

    // chống dò mật khẩu: 10 lần mỗi 15 phút cho mỗi email, 60 lần cho mỗi địa chỉ IP
    if (await L.limited("rl:e:" + uid, 10, 900) || await L.limited("rl:i:" + L.ip(req), 60, 900))
      return L.send(res, 429, { error: "Thử quá nhiều lần. Hãy đợi khoảng 15 phút rồi thử lại." });

    if (b.action === "register") {
      const salt = L.crypto.randomBytes(16).toString("hex");
      const rec = JSON.stringify({ email, name: name || email.split("@")[0], salt, hash: await L.hashPw(password, salt), at: Date.now() });
      const made = await L.redis("SET", "user:" + uid, rec, "NX");
      if (!made) return L.send(res, 409, { error: "Email này đã có tài khoản. Hãy chuyển sang Đăng nhập." });
      return L.send(res, 200, { token: L.makeToken(uid), user: { email, name: name || email.split("@")[0] } });
    }
    if (b.action === "login") {
      const raw = await L.redis("GET", "user:" + uid);
      const u = raw && JSON.parse(raw);
      const bad = () => L.send(res, 401, { error: "Email hoặc mật khẩu không đúng." });
      if (!u) { await L.hashPw(password, "0".repeat(32)); return bad(); }   // giữ thời gian phản hồi gần như nhau
      const got = Buffer.from(await L.hashPw(password, u.salt)), want = Buffer.from(u.hash);
      if (got.length !== want.length || !L.crypto.timingSafeEqual(got, want)) return bad();
      return L.send(res, 200, { token: L.makeToken(uid), user: { email: u.email, name: u.name } });
    }
    return L.send(res, 400, { error: "Yêu cầu không hợp lệ." });
  } catch (e) {
    console.error(e);
    return L.send(res, 500, { error: "Máy chủ gặp lỗi, hãy thử lại sau." });
  }
};
