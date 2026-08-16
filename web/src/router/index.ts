import { createRouter, createWebHistory } from 'vue-router';
import AppShell from '../layouts/AppShell.vue';
import LoginView from '../features/auth/views/LoginView.vue';
import RegisterView from '../features/auth/views/RegisterView.vue';
import ChatView from '../features/chat/views/ChatView.vue';
import ChatSidebarView from '../features/chat/views/ChatSidebarView.vue';
import ThreadView from '../features/chat/views/ThreadView.vue';
import { authGuard } from './guards';

declare module 'vue-router' {
  interface RouteMeta {
    /** Routes reachable without a session (auth guard skips the "must be logged in" check). */
    public?: boolean;
  }
}

// createWebHistory (NOT hash) — a future Electron wrapper will need a
// custom protocol handler to make this work under `file://`, but that's a
// later phase's problem; hash mode would be the wrong default to ship now.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { public: true },
    },
    {
      path: '/chat/:channelId?',
      component: AppShell,
      children: [
        {
          path: '',
          name: 'chat',
          components: {
            default: ChatView,
            sidebar: ChatSidebarView,
          },
        },
        {
          // The channel's own timeline (ChatView) stays visible in `default`
          // while ThreadView renders ThreadPanel into the `aside` slot.
          path: 'thread/:messageId',
          name: 'chat-thread',
          components: {
            default: ChatView,
            sidebar: ChatSidebarView,
            aside: ThreadView,
          },
        },
      ],
    },
    {
      path: '/',
      redirect: { name: 'chat' },
    },
  ],
});

router.beforeEach(authGuard);

export default router;
