<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhButton, PhInput, useToast } from '@phishyhub/design-system';
import AuthLayout from '../../../layouts/AuthLayout.vue';
import { useAuthStore } from '../../../stores/auth';
import { isApiError } from '../../../api/errors';

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const submitting = ref(false);
const errorMessage = ref('');

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

function mapError(err: unknown): string {
  if (isApiError(err)) {
    switch (err.code) {
      case 'CONFLICT':
        return 'An account with that email already exists.';
      case 'VALIDATION_ERROR':
        return 'Please check the fields below — password must be at least 8 characters.';
      case 'TOO_MANY_REQUESTS':
        return 'Too many attempts — please wait a moment and try again.';
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
    // registerUser always lands as role:'employee' server-side (CONTRACT.md
    // §3.2) — there is no elevated-role field to submit here even though
    // the form only asks for the basics.
    await authStore.register({
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
    });
    toast.push({ title: 'Welcome to Phishy Hub', variant: 'success' });
    await router.push('/chat');
  } catch (err) {
    errorMessage.value = mapError(err);
    toast.push({ title: 'Registration failed', description: errorMessage.value, variant: 'danger' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <form class="register-form" @submit.prevent="onSubmit">
      <h2 class="register-form__title">Create an account</h2>

      <div class="register-form__row">
        <label class="register-form__field">
          <span>First name</span>
          <PhInput v-model="firstName" placeholder="Ada" :invalid="!!errorMessage" />
        </label>
        <label class="register-form__field">
          <span>Last name</span>
          <PhInput v-model="lastName" placeholder="Lovelace" :invalid="!!errorMessage" />
        </label>
      </div>

      <label class="register-form__field">
        <span>Email</span>
        <PhInput v-model="email" type="email" placeholder="you@phishyhub.local" :invalid="!!errorMessage" />
      </label>

      <label class="register-form__field">
        <span>Password</span>
        <PhInput v-model="password" type="password" placeholder="At least 8 characters" :invalid="!!errorMessage" />
      </label>

      <p v-if="errorMessage" class="register-form__error" role="alert">{{ errorMessage }}</p>

      <PhButton
        type="submit"
        :loading="submitting"
        :disabled="!firstName || !lastName || !email || password.length < 8"
      >
        Create account
      </PhButton>

      <p class="register-form__switch">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>

<style scoped>
.register-form {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.register-form__title {
  margin: 0;
  font-size: var(--ph-font-size-xl);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.register-form__row {
  display: flex;
  gap: var(--ph-space-3);
}

.register-form__row .register-form__field {
  flex: 1;
  min-width: 0;
}

.register-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.register-form__error {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-danger);
}

.register-form__switch {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  text-align: center;
}
</style>
