import { createRouter, createWebHistory } from 'vue-router';
import AppShell from '../layouts/AppShell.vue';
import LoginView from '../features/auth/views/LoginView.vue';
import RegisterView from '../features/auth/views/RegisterView.vue';
import ChatView from '../features/chat/views/ChatView.vue';
import ChatSidebarView from '../features/chat/views/ChatSidebarView.vue';
import ThreadView from '../features/chat/views/ThreadView.vue';
import KanbanBoardView from '../features/boards/views/KanbanBoardView.vue';
import BoardsSidebarView from '../features/boards/views/BoardsSidebarView.vue';
import TicketDetailView from '../features/boards/views/TicketDetailView.vue';
import { authGuard, roleGuard } from './guards';
import type { UserRole } from '../api/types';

declare module 'vue-router' {
  interface RouteMeta {
    /** Routes reachable without a session (auth guard skips the "must be logged in" check). */
    public?: boolean;
    /**
     * Which rail entry a route belongs to — drives AppShell's active-state
     * highlighting (`meta.section`, not exact route-name matching, so a
     * nested route like `chat-thread` still highlights "Chat"). Every
     * top-level feature area sets this on its outer route; child routes
     * inherit it automatically since vue-router merges `meta` across the
     * whole matched chain.
     */
    section?: 'chat' | 'hr' | 'boards' | 'admin';
    /** Allow-list of roles that may reach this route (roleGuard). Omit/empty = open to any authenticated user. */
    roles?: UserRole[];
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
      meta: { section: 'chat' },
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
      path: '/boards',
      component: AppShell,
      meta: { section: 'boards' },
      children: [
        {
          path: '',
          name: 'boards',
          components: {
            default: KanbanBoardView,
            sidebar: BoardsSidebarView,
          },
        },
        {
          // The board (KanbanBoardView) stays visible in `default` while
          // TicketDetailView renders into the `aside` slot — same pattern as
          // /chat/:channelId/thread/:messageId above.
          path: 'ticket/:ticketId',
          name: 'boards-ticket',
          components: {
            default: KanbanBoardView,
            sidebar: BoardsSidebarView,
            aside: TicketDetailView,
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
router.beforeEach(roleGuard);

export default router;
