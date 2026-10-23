/* Hàm dùng chung cho /api. Không cần cài thư viện nào: chỉ dùng crypto của Node và fetch.
   Cơ sở dữ liệu: Upstash Redis qua REST (tích hợp "Upstash Redis" trong Vercel Marketplace tự thêm biến môi trường).
   Cần thêm một biến tự đặt: AUTH_SECRET (chuỗi ngẫu nhiên dài, ví dụ chạy `openssl rand -hex 32`). */
const crypto = require("crypto");

const env = process.env;
// Khi nối Upstash trong Vercel có thể chọn tiền tố tên biến (ví dụ STORAGE_KV_REST_API_URL), nên dò cả các tên có tiền tố.
const find = (...res) => { const k = Object.keys(env).find(n => env[n] && res.some(r => r.test(n))); return k ? env[k] : ""; };
const URL_ = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || find(/KV_REST_API_URL$/, /REDIS_REST_URL$/, /UPSTASH.*REST_URL$/);
const TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || find(/KV_REST_API_TOKEN$/, /REDIS_REST_TOKEN$/, /UPSTASH.*REST_TOKEN$/);
const SECRET = env.AUTH_SECRET || "";
const ready = () => !!(URL_ && TOKEN && SECRET.length >= 16);
// Liệt kê phần còn thiếu (chỉ báo thiếu gì, không lộ giá trị nào) để biết cần sửa chỗ nào trên Vercel.
const missing = () => [!URL_ && "db_url", !TOKEN && "db_token", !SECRET && "secret_missing", SECRET && SECRET.length < 16 && "secret_short"].filter(Boolean);

async function redis(...cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("redis: " + (j.error || r.status));
  return j.result;
}

const b64u = b => Buffer.from(b).toString("base64url");
const sign = p => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
const DAYS = 60;
function makeToken(uid) {
  const p = b64u(JSON.stringify({ u: uid, e: Math.floor(Date.now() / 1000) + DAYS * 86400 }));
  return p + "." + sign(p);
}
function readToken(h) {
  const m = /^Bearer (.+)$/.exec(h || ""); if (!m) return null;
  const [p, s] = m[1].split(".");
  if (!p || !s) return null;
  const want = Buffer.from(sign(p)), got = Buffer.from(s);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try { const d = JSON.parse(Buffer.from(p, "base64url").toString()); return d.e > Date.now() / 1000 ? d.u : null; } catch (e) { return null; }
}

const userId = email => crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
const hashPw = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, (e, k) => e ? no(e) : ok(k.toString("hex"))));
const ip = req => String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket && req.socket.remoteAddress || "?").trim();

// Giới hạn số lần thử: tối đa `max` lần trong `sec` giây cho mỗi khóa.
async function limited(key, max, sec) {
  const n = await redis("INCR", key);
  if (n === 1) await redis("EXPIRE", key, sec);
  return n > max;
}

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
const send = (res, code, obj) => { res.setHeader("Cache-Control", "no-store"); res.status(code).json(obj); };

module.exports = { redis, ready, missing, makeToken, readToken, userId, hashPw, ip, limited, body, send, crypto };
