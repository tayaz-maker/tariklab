// Compatibility tombstones only. No retired application, cache or save data ships.
export const retiredWorkerPaths = ['atlas/3d/sw.js', 'atlas/yapi/sw.js'];
export const retirementWorker = `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  const scope = new URL(self.registration.scope).pathname;
  for (const client of await self.clients.matchAll({type: 'window'})) {
    if (new URL(client.url).pathname.startsWith(scope)) await client.navigate('/');
  }
  await self.registration.unregister();
})()));
self.addEventListener('fetch', event => {
  if (new URL(event.request.url).pathname.startsWith(new URL(self.registration.scope).pathname)) {
    event.respondWith(Promise.resolve(new Response('Bu ürün kaldırıldı', {status: 410})));
  }
});
`;
