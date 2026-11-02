/* Emric service worker: receives Web Push messages and shows them, so run reminders arrive even when the app is closed.
 *
 * Browsers cannot schedule a notification for a later time from the page or the worker, so the timing lives on the
 * server (supabase/functions/push-reminders, run every 10 minutes). The server checks the athlete's synced log, and only
 * sends a reminder while today's run is still missing. The worker's job is simply: show what arrives, and open the app
 * when it is tapped. There is no fetch handler: nothing about how the app loads or caches is touched. */
'use strict';

const DEFAULT_TAG = 'emric-run-reminder';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    try { indexedDB.deleteDatabase('emric-sw'); } catch (err) {}   // left behind by the earlier, timer-based version of this worker
  })());
});

// Every push MUST end in a visible notification (browsers, and iOS in particular, penalise silent pushes).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (err) { try { d = { body: e.data.text() }; } catch (err2) {} }
  const title = String(d.title || 'Emric');
  e.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || 'Open Emric to see today\u2019s session.'),
    tag: String(d.tag || DEFAULT_TAG),
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: String(d.url || './') }
  }));
});

// The browser can rotate or expire a subscription. Try to renew it, then tell any open page so it re-saves it.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const old = e.oldSubscription;
      if (old && old.options) await self.registration.pushManager.subscribe(old.options);
    } catch (err) {}
    const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    cs.forEach((c) => { try { c.postMessage({ t: 'resubscribed' }); } catch (err) {} });
  })());
});

// Tapping a reminder focuses the app if it is open, otherwise opens it.
self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  try { n.close(); } catch (err) {}
  e.waitUntil((async () => {
    const url = new URL((n.data && n.data.url) || './', self.registration.scope).href;
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { try { await c.focus(); return; } catch (err) {} }
    try { await self.clients.openWindow(url); } catch (err) {}
  })());
});
