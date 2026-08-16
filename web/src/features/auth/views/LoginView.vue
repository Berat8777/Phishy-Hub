<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PhButton, PhInput, useToast } from '@phishyhub/design-system';
import AuthLayout from '../../../layouts/AuthLayout.vue';
import { useAuthStore } from '../../../stores/auth';
import { isApiError } from '../../../api/errors';

const email = ref('');
const password = ref('');
const submitting = ref(false);
const errorMessage = ref('');

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const toast = useToast();

function mapError(err: unknown): string {
  if (isApiError(err)) {
    switch (err.code) {
      case 'UNAUTHORIZED':
        return 'Invalid email or password.';
      case 'VALIDATION_ERROR':
        return 'Please check your email and password.';
      case 'TOO_MANY_REQUESTS':
        return 'Too many attempts — please wait a moment and try again.';
      case 'FORBIDDEN':
        return 'This account is not active.';
      default:
        return err.message || 'Something went wrong. Please try again.';
    }
  }
  return 'Could not reach the server. Please check your connection.';
}

async function onSubmit(): Promise<void> {
  errorMessage.value = '';
  submitting.value = true;
  try {
    await authStore.login({ email: email.value, password: password.value });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/chat';
    await router.push(redirect);
  } catch (err) {
    errorMessage.value = mapError(err);
    toast.push({ title: 'Sign in failed', description: errorMessage.value, variant: 'danger' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <form class="login-form" @submit.prevent="onSubmit">
      <h2 class="login-form__title">Sign in</h2>
      <p v-if="route.query.reason === 'expired'" class="login-form__notice">
        Your session expired — please sign in again.
      </p>

      <label class="login-form__field">
        <span>Email</span>
        <PhInput v-model="email" type="email" placeholder="you@phishyhub.local" :invalid="!!errorMessage" />
      </label>

      <label class="login-form__field">
        <span>Password</span>
        <PhInput v-model="password" type="password" placeholder="********" :invalid="!!errorMessage" />
      </label>

      <p v-if="errorMessage" class="login-form__error" role="alert">{{ errorMessage }}</p>

      <PhButton type="submit" :loading="submitting" :disabled="!email || !password">Sign in</PhButton>

      <p class="login-form__switch">
        No account?
        <RouterLink to="/register">Register</RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.login-form__title {
  margin: 0;
  font-size: var(--ph-font-size-xl);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.login-form__notice {
  margin: 0;
  padding: var(--ph-space-2) var(--ph-space-3);
  background-color: var(--ph-color-warning-subtle);
  color: var(--ph-color-warning-subtle-text);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
}

.login-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.login-form__error {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-danger);
}

.login-form__switch {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  text-align: center;
}
</style>
