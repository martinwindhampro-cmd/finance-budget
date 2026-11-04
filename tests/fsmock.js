// Mini Firestore partagé entre plusieurs fenêtres (simulation de plusieurs appareils/utilisateurs)
module.exports = function install(win, shared, user) {
  const S = shared;                       // { store: Map, listeners: Set, seq }
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const P = win.Promise;
  const FV = { arrayUnion: (...v) => ({ __op: 'union', v }), arrayRemove: (...v) => ({ __op: 'remove', v }), delete: () => ({ __op: 'del' }), serverTimestamp: () => Date.now() };
  const err = code => { const e = new Error(code); e.code = code; return e; };
  const parent = p => p.split('/').slice(0, -1).join('/');
  const accOf = p => { const m = p.match(/^accounts\/([^/]+)/); return m ? m[1] : null; };
  const me = () => win.__auth.user;
  function canRead(p, d) {
    const u = me(); if (!u) return false;
    if (p.startsWith('users/')) return p.split('/')[1] === u.uid;
    if (p.startsWith('invites/')) return d && (d.from === u.uid || d.to === u.email.toLowerCase());
    if (p.startsWith('directory/')) { const e = p.split('/')[1], m = u.email.toLowerCase(), l = S.store.get('links/' + [e, m].sort().join('__')); return e === m || (!!l && l.status === 'accepted'); }
    if (p.startsWith('links/')) return !d || (d.emails || []).includes(u.email.toLowerCase());
    if (p.startsWith('pdebts/')) return !d || (d.members || []).includes(u.uid);
    if (p.startsWith('transfers/')) return !d || d.from === u.uid || d.to === u.email.toLowerCase();
    const a = accOf(p); if (a) { const ad = S.store.get('accounts/' + a); return !!ad && (ad.members || []).includes(u.uid); }
    return false;
  }
  function canWrite(p, before, after) {
    const u = me(); if (!u) return false;
    if (p.startsWith('users/')) return p.split('/')[1] === u.uid;
    if (p.startsWith('invites/')) { const d = before || after; return d.from === u.uid || (d.to === u.email.toLowerCase() && (!after || u.emailVerified)); }
    if (p.startsWith('directory/')) return p.split('/')[1] === u.email.toLowerCase() && (!after || after.uid === u.uid);
    if (p.startsWith('links/')) { const m = u.email.toLowerCase();
      if (!before) return after.from === u.uid && after.status === 'pending' && after.emails.includes(m) && p.split('/')[1] === after.emails.slice().sort().join('__') && after.to !== m;
      if (!after) return before.emails.includes(m);
      const ch = Object.keys(Object.assign({}, before, after)).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      return before.to === m && before.status === 'pending' && ['accepted', 'declined'].includes(after.status) && ch.every(k => ['status', 'answeredAt', 'uids'].includes(k)); }
    if (p.startsWith('pdebts/')) { if (!before) return (after.members || []).includes(u.uid) && after.members.length === 2;
      if (!after) return before.members.includes(u.uid) && before.closed === true;
      return before.members.includes(u.uid) && JSON.stringify(before.members) === JSON.stringify(after.members); }
    if (p.startsWith('transfers/')) {
      const em = u.email.toLowerCase();
      if (!before) return after.from === u.uid && after.status === 'sent';
      if (!after) return before.from === u.uid || before.to === em;
      if (before.from === u.uid && before.status === 'sent' && after.from === u.uid) return true;
      if (before.to === em && before.status === 'sent' && after.status === 'received') {
        const ch = new Set([...Object.keys(before), ...Object.keys(after)].filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])));
        return [...ch].every(k => ['status', 'toAcc', 'toAccName', 'receivedAt'].includes(k));
      }
      return false;
    }
    const a = accOf(p); if (!a) return false;
    if (p === 'accounts/' + a) {
      if (!before) return after.owner === u.uid && JSON.stringify(after.members) === JSON.stringify([u.uid]);
      if ((before.members || []).includes(u.uid)) return true;
      const inv = S.store.get('invites/' + a + '_' + u.email.toLowerCase());
      return !!(after && inv && inv.status === 'pending' && u.emailVerified);
    }
    const ad = S.store.get('accounts/' + a); return !!ad && (ad.members || []).includes(u.uid);
  }
  function applyUpdate(d, upd) {
    d = clone(d) || {};
    for (const [k, v] of Object.entries(upd)) {
      const path = k.split('.'); let o = d; for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {};
      const last = path[path.length - 1];
      if (v && v.__op === 'union') { o[last] = o[last] || []; v.v.forEach(x => { if (!o[last].includes(x)) o[last].push(x); }); }
      else if (v && v.__op === 'remove') o[last] = (o[last] || []).filter(x => !v.v.includes(x));
      else if (v && v.__op === 'del') delete o[last];
      else o[last] = clone(v);
    }
    return d;
  }
  function write(ops) {             // ops: [{type, path, data, opt}]
    const staged = new Map();
    const get = p => staged.has(p) ? staged.get(p) : S.store.get(p);
    for (const op of ops) {
      const before = get(op.path); let after;
      if (op.type === 'set') after = op.opt && op.opt.merge ? applyUpdate(before, op.data) : applyUpdate({}, op.data);
      else if (op.type === 'update') { if (!before) return P.reject(err('not-found')); after = applyUpdate(before, op.data); }
      else after = undefined;
      if (!canWrite(op.path, before, after)) return P.reject(err('permission-denied'));
      staged.set(op.path, after);
    }
    S.writes = (S.writes || 0) + 1;
    staged.forEach((v, p) => v === undefined ? S.store.delete(p) : S.store.set(p, v));
    S.notify(); return P.resolve();
  }
  function snapDoc(p) { const d = S.store.get(p); return { id: p.split('/').pop(), exists: d !== undefined, data: () => clone(d), ref: docRef(p), metadata: { hasPendingWrites: false, fromCache: false } }; }
  function docRef(p) {
    return { id: p.split('/').pop(), path: p,
      collection: n => colRef(p + '/' + n),
      get: () => { const d = S.store.get(p); if (d !== undefined && !canRead(p, d)) return P.reject(err('permission-denied')); return P.resolve(snapDoc(p)); },
      set: (data, opt) => write([{ type: 'set', path: p, data, opt }]),
      update: data => write([{ type: 'update', path: p, data }]),
      delete: () => write([{ type: 'delete', path: p }]),
      onSnapshot(a, b, c) { const cb = typeof a === 'function' ? a : b, eb = typeof a === 'function' ? b : c;
        const L = { win, fire() { const d = S.store.get(p);
            if (!canRead(p, d)) { if (this.last !== '§denied') { this.last = '§denied'; eb && eb(err('permission-denied')); } return; }
            const j = JSON.stringify(d === undefined ? null : d); if (j === this.last) return; this.last = j; cb(snapDoc(p)); } };
        S.listeners.add(L); setTimeout(() => L.fire(), 0); return () => S.listeners.delete(L); } };
  }
  function colRef(p, filters = [], ord = null, lim = null) {
    const run = () => {
      let docs = [...S.store.keys()].filter(k => parent(k) === p).map(k => snapDoc(k)).filter(s => canRead(s.ref.path, s.data()));
      filters.forEach(([f, o, v]) => docs = docs.filter(s => o === 'array-contains' ? (s.data()[f] || []).includes(v) : s.data()[f] === v));
      if (ord) docs.sort((x, y) => (x.data()[ord[0]] > y.data()[ord[0]] ? 1 : -1) * (ord[1] === 'desc' ? -1 : 1));
      if (lim) docs = docs.slice(0, lim);
      return docs;
    };
    if (accOf(p) && !canRead(p)) {}
    return { path: p,
      doc: id => docRef(p + '/' + (id || ('auto' + (++S.seq) + Math.random().toString(36).slice(2, 8)))),
      add: data => { const r = docRef(p + '/auto' + (++S.seq)); return r.set(data).then(() => r); },
      where: (f, o, v) => colRef(p, filters.concat([[f, o, v]]), ord, lim),
      orderBy: (f, dir) => colRef(p, filters, [f, dir || 'asc'], lim),
      limit: n => colRef(p, filters, ord, n),
      get: () => { const a = accOf(p); if (a && !canRead(p + '/x', {})) return P.reject(err('permission-denied')); const docs = run(); return P.resolve({ docs, empty: !docs.length, size: docs.length }); },
      onSnapshot(a, b, c) { const cb = typeof a === 'function' ? a : b, eb = typeof a === 'function' ? b : c;
        const L = { win, prev: new Map(), fire() {
            const acc = accOf(p); if (acc && !canRead(p + '/x', {})) { if (!this.denied) { this.denied = 1; eb && eb(err('permission-denied')); } return; }
            const docs = run(), now = new Map(docs.map(s => [s.id, JSON.stringify(s.data())]));
            const ch = [];
            docs.forEach(s => { const o = this.prev.get(s.id); if (o === undefined) ch.push({ type: 'added', doc: s }); else if (o !== now.get(s.id)) ch.push({ type: 'modified', doc: s }); });
            this.prev.forEach((v, id) => { if (!now.has(id)) ch.push({ type: 'removed', doc: { id, data: () => JSON.parse(v), metadata: { hasPendingWrites: false } } }); });
            if (!ch.length && this.started) return; this.started = 1; this.prev = now;
            cb({ docs, empty: !docs.length, size: docs.length, metadata: { hasPendingWrites: false, fromCache: false }, docChanges: () => ch }); } };
        S.listeners.add(L); setTimeout(() => L.fire(), 0); return () => S.listeners.delete(L); } };
  }
  const fs = { enablePersistence: () => P.resolve(), collection: n => colRef(n),
    async runTransaction(fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const ops = [], reads = new Map();
        const tx = { get: async r => { const d = S.store.get(r.path); if (d !== undefined && !canRead(r.path, d)) throw err('permission-denied'); reads.set(r.path, JSON.stringify(d)); return snapDoc(r.path); },
          set: (r, data, opt) => { ops.push({ type: 'set', path: r.path, data, opt }); return tx; },
          update: (r, data) => { ops.push({ type: 'update', path: r.path, data }); return tx; },
          delete: r => { ops.push({ type: 'delete', path: r.path }); return tx; } };
        const res = await fn(tx);
        if (S.txDelay) await new Promise(r => setTimeout(r, S.txDelay));
        if ([...reads].some(([p, j]) => JSON.stringify(S.store.get(p)) !== j)) continue;   // conflit → on rejoue
        if (ops.length) await write(ops);
        return res;
      }
      throw err('aborted');
    },
    batch() { const ops = []; return { set: (r, data, opt) => ops.push({ type: 'set', path: r.path, data, opt }), update: (r, data) => ops.push({ type: 'update', path: r.path, data }), delete: r => ops.push({ type: 'delete', path: r.path }), commit: () => write(ops) }; } };
  win.__auth = { user: null, cb: null };
  const authObj = { languageCode: 'fr', get currentUser() { return win.__auth.user; }, onAuthStateChanged(cb) { win.__auth.cb = cb; }, signOut() { win.__auth.user = null; win.__auth.cb(null); return P.resolve(); } };
  win.firebase = { initializeApp() {}, auth: Object.assign(() => authObj, { EmailAuthProvider: { credential() {} } }), firestore: Object.assign(() => fs, { FieldValue: FV }) };
  win.__login = u => { win.__auth.user = Object.assign({ emailVerified: false, reload: () => P.resolve(), getIdToken: () => P.resolve('t'), sendEmailVerification: () => P.resolve() }, u); win.__auth.cb(win.__auth.user); };
};
