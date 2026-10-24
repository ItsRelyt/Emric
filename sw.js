/* Minimal service worker: lets browsers treat Emric as an installable app.
   It does not cache or intercept anything, so the app always loads fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
