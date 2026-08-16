import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as usersApi from '../api/endpoints/users';
import type { UserDTO } from '../api/types';

/** Thinner for this pass — a simple id-keyed cache, filled on demand. */
export const useUsersStore = defineStore('users', () => {
  const byId = ref<Map<string, UserDTO>>(new Map());

  function upsert(user: UserDTO): void {
    byId.value.set(user.id, user);
  }

  function getUser(userId: string): UserDTO | undefined {
    return byId.value.get(userId);
  }

  async function fetchUser(userId: string): Promise<UserDTO> {
    const cached = byId.value.get(userId);
    if (cached) return cached;
    const user = await usersApi.getUser(userId);
    upsert(user);
    return user;
  }

  function reset(): void {
    byId.value = new Map();
  }

  return { byId, upsert, getUser, fetchUser, reset };
});
