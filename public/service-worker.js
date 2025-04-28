// Service worker to maintain recording when browser focus is lost
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// This service worker primarily helps with background operation.
// The main recording functionality is handled in the React app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    // Respond to keep alive pings
    event.source.postMessage({ type: 'PONG' });
  }
});
