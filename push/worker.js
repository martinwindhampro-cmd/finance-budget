/* Suivi dépenses : relais de notifications (Cloudflare Worker, gratuit).
   L'app envoie { to: [abonnements push], title, body } avec le jeton de connexion Firebase de l'expéditeur.
   Le relais vérifie le jeton, puis envoie une vraie notification (Web Push chiffré, RFC 8291 + VAPID RFC 8292)
   à chaque appareil du destinataire. Il ne garde rien en mémoire.
   ⚠ La ligne VAPID_PRIVATE est remplie dans la copie collée dans Cloudflare (jamais dans ce dépôt public). */
const VAPID_PUBLIC = '__VAPID_PUBLIC__';
const VAPID_PRIVATE = '__VAPID_PRIVATE__';
const PROJECT = 'finance-budget-2026';
const ORIGINS = ['https://martinwindhampro-cmd.github.io'];
const CONTACT = 'https://martinwindhampro-cmd.github.io/finance-budget/';   // Apple refuse un contact fictif (BadJwtToken)
const PUSH_HOSTS = /^https:\/\/([a-z0-9.-]+\.)?(push\.apple\.com|fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//;

const te = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; a.forEach(x => { o.set(x, i); i += x.length; }); return o; };

// ---------- Jeton Firebase (RS256) ----------
let jwks = null, jwksAt = 0;
async function checkToken(tok) {
  const [h, p, s] = String(tok || '').split('.'); if (!s) throw new Error('jeton');
  const head = JSON.parse(new TextDecoder().decode(unb64u(h))), pay = JSON.parse(new TextDecoder().decode(unb64u(p)));
  const now = Date.now() / 1000;
  if (pay.aud !== PROJECT || pay.iss !== 'https://securetoken.google.com/' + PROJECT || !(pay.exp > now) || !pay.sub) throw new Error('jeton');
  if (!jwks || Date.now() - jwksAt > 3600e3) { jwks = (await (await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')).json()).keys; jwksAt = Date.now(); }
  const jwk = jwks.find(k => k.kid === head.kid); if (!jwk) throw new Error('jeton');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), te.encode(h + '.' + p))) throw new Error('jeton');
  return pay;
}

// ---------- VAPID (ES256) ----------
async function vapidKey() {
  const pub = unb64u(VAPID_PUBLIC);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function vapidAuth(endpoint) {
  const aud = new URL(endpoint).origin, h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(), te.encode(h + '.' + p));
  return 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + VAPID_PUBLIC;
}

// ---------- Chiffrement du message (aes128gcm) ----------
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function encrypt(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}
async function send(sub, msg) {
  if (!sub || !PUSH_HOSTS.test(sub.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) return 400;
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' }, body: await encrypt(sub, msg) });
  return r.status;
}

const cors = o => ({ 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Content-Type': 'application/json' });
export default {
  async fetch(req) {
    const o = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(o) });
    if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, key: VAPID_PUBLIC }), { headers: cors(o) });
    try {
      if (!ORIGINS.includes(o)) return new Response('{"error":"origin"}', { status: 403, headers: cors(o) });
      const who = await checkToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''));
      const b = await req.json(), to = (Array.isArray(b.to) ? b.to : []).slice(0, 10);
      const msg = JSON.stringify({ title: String(b.title || 'Suivi dépenses').slice(0, 80), body: String(b.body || '').slice(0, 200), tag: String(b.tag || '').slice(0, 60), from: who.email || '' });
      const res = await Promise.all(to.map(s => send(s, msg).catch(() => 500)));
      return new Response(JSON.stringify({ res, gone: to.filter((s, i) => res[i] === 404 || res[i] === 410).map(s => s.endpoint) }), { headers: cors(o) });
    } catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 401, headers: cors(o) }); }
  }
};
