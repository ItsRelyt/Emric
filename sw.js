/* Emric service worker: run reminders that keep arriving twice a day until the athlete logs today's run.
 * The page (see the matching block at the top of index.html) posts 'set' with two slots for today while the app is open,
 * and 'clear' the moment a workout for the day exists in the log. Each slot becomes a scheduled local notification
 * (showNotification with a past/future `timestamp`), so it fires even when the app is closed. On every wake-up the
 * worker re-checks the last state it heard from the page and asks any open client, so reminders stop as soon as the run
 * is logged and keep coming on days it is not. No fetch handler: nothing about how the app loads or caches has changed. */
'use strict';

const TAG = 'emric-run-reminder';
const PLAN_KEY = 'runplan', DONE_KEY = 'rundone', SENT_KEY = 'sentslot', TIME_KEY = 'rumtime';
const IDS = ['emric-run-0', 'emric-run-1'];

// Workers have no localStorage, so today's plan and the last "did you run?" answer live in IndexedDB.
function kvOpen() {
  return new Promise((res) => {
    let req = null;
    try { req = indexedDB.open('emric-sw', 1); } catch (e) { return res(null); }
    req.onupgradeneeded = () => { try { req.result.createObjectStore('kv'); } catch (e) {} };
    req.onerror = req.onblocked = () => res(null);
    req.onsuccess = () => res(req.result);
  });
}
function kv(name, value) {   // no value: read; with value: write
  return kvOpen().then((db) => {
    if (!db) return null;
    return new Promise((res) => {
      let out = null;
      try {
        const tx = db.transaction('kv', value === undefined ? 'readonly' : 'readwrite');
        const st = tx.objectStore('kv');
        if (value === undefined) { const rq = st.get(name); rq.onsuccess = () => { out = rq.result === undefined ? null : rq.result; }; rq.onerror = () => { out = null; }; }
        else st.put(value, name);
        tx.oncomplete = () => { try { db.close(); } catch (e) {} res(out); };
        tx.onerror = tx.onabort = () => { try { db.close(); } catch (e) {} res(out); };
      } catch (e) { try { db.close(); } catch (e2) {} res(null); }
    });
  });
}

const localDay = (t) => new Date(t || Date.now()).toLocaleDateString('en-CA');
const notifOpts = (s) => ({
  body: s.body, tag: TAG, id: s.id, icon: 'icon-192.png', badge: 'icon-192.png',
  timestamp: s.at, data: { url: './', day: s.day, slot: s.id }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

function closeAll() {
  return self.registration.getNotifications({ tag: TAG })
    .then((ns) => { ns.forEach((n) => { try { n.close(); } catch (e) {} }); })
    .catch(() => {});
}
function clearPlan() {   // stops today's nagging; the reminder times stay remembered for later days
  return closeAll()
    .then(() => Promise.all(IDS.map((id) => self.registration.cancel(id).catch(() => {}))))
    .then(() => kv(PLAN_KEY, null))
    .then(() => kv(SENT_KEY, null));
}

// Arm one slot. A future slot becomes a scheduled notification that fires even with the app closed; a slot whose time
// has passed notifies straight away, but only once per day (the delivered marker lives in IndexedDB).
async function armSlot(s) {
  if (s.at > Date.now()) { await self.registration.showNotification(s.title, notifOpts(s)).catch(() => {}); return false; }
  const sent = (await kv(SENT_KEY)) || {};
  if (sent[s.id] === s.day) return true;                          // this reminder already went out on that day
  const o = notifOpts(s);
  delete o.timestamp;
  await self.registration.showNotification(s.title, o).catch(() => {});
  sent[s.id] = s.day;
  await kv(SENT_KEY, sent);
  return true;
}

self.addEventListener('message', (e) => {
  const d = (e && e.data) || {};
  if (d.t === 'set' && Array.isArray(d.slots) && d.slots.length) {
    e.waitUntil((async () => {
      const day = d.slots[0].day || localDay(d.slots[0].at);
      await kv(DONE_KEY, { day, done: false });                 // the page says: no run yet today
      const old = await kv(PLAN_KEY);
      if (old && old.day && old.day !== day) await closeAll();   // yesterday's notifications should not linger
      await kv(PLAN_KEY, { day, slots: d.slots });
      await saveTimes(d.slots);                                  // remembered for days when the app stays shut
      await kv(SENT_KEY, {});                                    // fresh word from the page: today's slots may notify again
      if (await loggedToday(day)) { await clearPlan(); return; }
      for (const s of d.slots) await armSlot(s);
      try { if (self.registration.periodicSync) await self.registration.periodicSync.register('emric-run', { minInterval: 3600e3 }); } catch (err) {}
    })());
  } else if (d.t === 'ran') {                                      // the page says: this day is trained
    e.waitUntil((async () => {
      const day = d.day || localDay();
      await kv(DONE_KEY, { day, done: true });
      await clearPlan();
      try { if (self.registration.periodicSync) await self.registration.periodicSync.unregister('emric-run'); } catch (err) {}
    })());
  } else if (d.t === 'clear') {
    e.waitUntil((async () => {                                  // a run for the day exists: stop the nagging
      const day = d.day || localDay();
      await kv(DONE_KEY, { day, done: true });
      await clearPlan();
      try { if (self.registration.periodicSync) await self.registration.periodicSync.unregister('emric-run'); } catch (err) {}
    })());
  }
});

// Did the athlete run on `day`? The page reports it while it is open ('ran'), and any open client answers a probe.
// With no evidence either way the reminders keep coming — that is the point of nagging twice a day until the run.
async function loggedToday(day) {
  const done = await kv(DONE_KEY);
  if (done && done.day === day && typeof done.done === 'boolean') return done.done;
  return await askClients(day) === 'done';
}
function askClients(day) {
  return new Promise((res) => {
    let settled = false, timer = 0;
    const finish = (v) => { if (!settled) { settled = true; clearTimeout(timer); navigator.serviceWorker.removeEventListener('message', onMsg); res(v); } };
    const onMsg = (e) => { const d = (e && e.data) || {}; if (d.t === 'answer') finish(d.done ? 'done' : 'pending'); };
    navigator.serviceWorker.addEventListener('message', onMsg);
    self.clients.matchAll({ includeUncontrolled: true }).then((cs) => {
      if (!cs.length) return finish(null);
      cs.forEach((c) => { try { c.postMessage({ t: 'ask', day }); } catch (e) {} });
      timer = setTimeout(() => finish(null), 1500);
    }).catch(() => finish(null));
  });
}

// Helpers for the fixed reminder times: keep the clock time of a slot and move it onto another calendar day.
function clockHM(at) {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes()];
}
function atLocal(day, hm) {
  const p = day.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], hm[0], hm[1], 0, 0).getTime();
}

// Safety net for throttled or missed alarms: whenever the worker wakes, bring the reminders up to date. The two times
// are fixed (08:00 and 18:30), so a wake-up delivers anything that came due while it slept and keeps the next alarm
// armed. Once both of an untrained day's reminders have gone out, tomorrow's pair is armed too — the twice-a-day
// nagging carries on by itself until the page reports the run (or the app is opened again).
async function checkSlots() {
  const times = await kv(TIME_KEY);
  if (!Array.isArray(times) || !times.length) return;            // the app has never told us about a plan yet
  let plan = await kv(PLAN_KEY);
  if (!plan || !Array.isArray(plan.slots)) plan = { day: localDay(), slots: slotsForDay(times, localDay()) };
  const today = localDay(), now = Date.now();
  if (plan.day !== today && await loggedToday(plan.day)) { await kv(PLAN_KEY, null); plan = { day: today, slots: slotsForDay(times, today) }; }
  else if (plan.day !== today) plan = { day: today, slots: rollToDay(plan.slots, today) };   // catch up to today
  if (await loggedToday(today)) return clearPlan();
  for (const s of plan.slots) await armSlot(s);                                   // deliver what is due, keep the rest armed
  if (plan.slots.every((s) => s.at <= now)) {                                     // both of today's reminders are done
    const tmr = localDay(now + 86400e3);
    plan = { day: tmr, slots: slotsForDay(times, tmr) };
    await kv(SENT_KEY, {});                                                       // the new day's reminders may go out
    await kv(DONE_KEY, { day: tmr, done: false });                                 // nothing logged yet on the new day
    for (const s of plan.slots) await armSlot(s);
  }
  await kv(PLAN_KEY, plan);
}
function rollToDay(slots, day) {   // same clock times, moved onto another calendar day
  return slots.map((s, i) => ({ id: IDS[i] || ('emric-run-' + i), at: atLocal(day, clockHM(s.at)), day, title: s.title, body: s.body }));
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'emric-run') e.waitUntil(checkSlots()); });
self.addEventListener('sync', (e) => { if (e.tag === 'emric-run') e.waitUntil(checkSlots()); });

// A reminder that went off stays in the tray until acted on; clicking opens the app to log the run.
self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  try { n.close(); } catch (err) {}
  e.waitUntil((async () => {
    const url = (n.data && n.data.url) || './';
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { try { await c.focus(); return; } catch (err) {} }
    try { await self.clients.openWindow(url); } catch (err) {}
  })());
});
