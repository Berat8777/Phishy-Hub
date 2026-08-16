import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { useToast } from '@phishyhub/design-system';
import App from './App.vue';
import router from './router';
import './styles/app.css';
import * as tokenManager from './api/tokenManager';
import { useAuthStore } from './stores/auth';
import { connectSocket } from './socket/connection';
import { initEventBridge } from './socket/eventBridge';
import { initElectronIntegration } from './lib/electronBridge';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Single call site (repo instructions): components must never call
// `socket.on` directly, every server -> client event goes through here.
initEventBridge();

// No-op outside the desktop/ Electron shell (guarded internally on
// `window.phishyHub`, only present when preload.ts's contextBridge ran).
initElectronIntegration(router);

// A session may already be in localStorage (page reload) — reconnect
// immediately rather than waiting for a fresh login() call.
if (tokenManager.isAuthenticated()) {
  connectSocket();
}

// Forced logout: refresh ultimately failed (revoked token family, expired
// refresh token). Clear everything, tell the user, send them back to /login.
tokenManager.onSessionExpired((reason) => {
  useAuthStore().hardReset();
  useToast().push({ title: 'Session expired', description: reason, variant: 'warning' });
  void router.push({ name: 'login', query: { reason: 'expired' } });
});

app.mount('#app');
