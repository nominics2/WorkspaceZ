/**
 * WorkspaceZ Progressive Web App Service Worker
 * Handles real-time push notifications and background interactions.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, url, type, related_app_update_id } = data;

    const options = {
      body: body || 'New update from WorkspaceZ',
      icon: icon || '/brand/logomark.png',
      badge: badge || '/brand/logomark.png',
      data: {
        url: url || '/',
        type: type,
        updateId: related_app_update_id
      },
      tag: type === 'app_update' ? `update-${related_app_update_id}` : 'workspace-alert',
      renotify: true,
      vibrate: [100, 50, 100]
    };

    event.waitUntil(
      self.registration.showNotification(title || 'WorkspaceZ', options)
    );
  } catch (err) {
    console.error('[SW] Push processing failed:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const url = notification.data?.url || '/';

  notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Cache management and lifecycle can be added here in future steps.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
