/**
 * Workspace Z - PWA Service Worker
 * Handles incoming push notifications and browser interactions.
 */

self.addEventListener('push', function(event) {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Workspace Z';
      const options = {
        body: data.body || '',
        icon: data.icon || '/brand/logomark.png',
        badge: data.badge || '/brand/logomark.png',
        data: {
          url: data.url || '/'
        },
        vibrate: [100, 50, 100],
        requireInteraction: false
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Try to find an existing window and focus it
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
