/* Suivi dépenses — service worker : l'app s'ouvre vite et même sans réseau.
   • La page (index.html) : réseau d'abord → toujours la dernière version publiée ; copie de secours hors ligne.
   • Bibliothèques (Firebase, Chart.js, polices) et icônes : copie locale d'abord (leurs adresses ont un numéro de version).
   • Les données (Firestore, connexion) ne passent PAS par ici : Firebase gère lui-même le hors-ligne. */
const V = 'budget-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (r.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    // « no-store » : on ignore toute copie gardée par le navigateur → toujours la version publiée sur GitHub
    e.respondWith(fetch(r.url, { cache: 'no-store', credentials: 'same-origin' }).then(res => { if (!res.ok) throw 0; const cp = res.clone(); caches.open(V).then(c => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (LIBS.test(r.url) || (url.origin === location.origin && /\.(png|webmanifest)$/.test(url.pathname))) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
  }
});
// Clic sur une notification : ouvre (ou ramène) l'app, directement sur la question à valider (act = « pc|avance|paiement »…)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const act = (e.notification.data && e.notification.data.act) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    if (l.length) { if (act) l[0].postMessage({ act }); return l[0].focus(); }
    return self.clients.openWindow('./' + (act ? '?act=' + encodeURIComponent(act) : ''));
  }));
});
// Vraie notification (envoyée par le relais, même app fermée) : « Robin dit t'avoir remboursé · Vacances »
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Suivi dépenses', { body: d.body || 'Nouvelle demande à valider', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag ? d.tag + '-' + Date.now() : undefined, data: { act: d.tag && d.tag !== 'test' ? d.tag : '' } })
    .then(() => self.navigator.setAppBadge ? self.navigator.setAppBadge() : null).catch(() => {}));
});
