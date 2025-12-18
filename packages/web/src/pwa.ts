/**
 * PWA Registration
 *
 * Registers the service worker and handles updates.
 */

import { registerSW } from 'virtual:pwa-register';
import { UI_CONSTANTS } from '@seame/core';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
    // Could show a toast notification here
  },
  onRegistered(registration) {
    console.log('Service Worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service Worker registration error:', error);
  },
});

// Check for updates every hour
setInterval(() => {
  updateSW(false);
}, UI_CONSTANTS.SW_UPDATE_CHECK_INTERVAL_MS);

export { updateSW };
