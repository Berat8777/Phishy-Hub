<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__aurora" aria-hidden="true">
      <span class="auth-layout__blob auth-layout__blob--blue" />
      <span class="auth-layout__blob auth-layout__blob--orange" />
      <span class="auth-layout__grain" />
    </div>

    <div class="auth-layout__content">
      <div class="auth-layout__brand">
        <span class="auth-layout__mark">P</span>
        <h1>Phishy&nbsp;Hub</h1>
        <p class="auth-layout__tagline">Where your team actually gets things done.</p>
      </div>
      <div class="auth-layout__card">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ph-space-5);
  overflow: hidden;
  background: var(--ph-color-bg-canvas);
}

.auth-layout__aurora {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.auth-layout__blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.55;
  animation: ph-auth-drift 18s var(--ph-ease-out) infinite alternate;
}

.auth-layout__blob--blue {
  top: -12%;
  left: -8%;
  width: 46vw;
  height: 46vw;
  max-width: 640px;
  max-height: 640px;
  background: radial-gradient(circle, var(--ph-palette-blue-500), var(--ph-palette-blue-700) 70%);
}

.auth-layout__blob--orange {
  bottom: -18%;
  right: -10%;
  width: 38vw;
  height: 38vw;
  max-width: 520px;
  max-height: 520px;
  background: radial-gradient(circle, var(--ph-palette-orange-400), var(--ph-palette-orange-600) 70%);
  animation-delay: -6s;
}

.auth-layout__grain {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
}

@keyframes ph-auth-drift {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(4%, 6%) scale(1.08);
  }
}

.auth-layout__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ph-space-6);
  width: 100%;
}

.auth-layout__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ph-space-2);
  text-align: center;
  animation: ph-auth-in var(--ph-duration-base) var(--ph-ease-out);
}

.auth-layout__mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--ph-space-2);
  border-radius: var(--ph-radius-lg);
  background: linear-gradient(135deg, var(--ph-palette-blue-500), var(--ph-palette-orange-500));
  color: var(--ph-color-text-inverse);
  font-family: var(--ph-font-family-base);
  font-size: var(--ph-font-size-2xl);
  font-weight: var(--ph-font-weight-bold);
  box-shadow: 0 12px 32px -8px rgb(37 99 235 / 0.5);
}

.auth-layout__brand h1 {
  margin: 0;
  font-size: var(--ph-font-size-5xl);
  font-weight: var(--ph-font-weight-bold);
  letter-spacing: -0.02em;
  line-height: 1.05;
  background: linear-gradient(120deg, var(--ph-palette-blue-600) 10%, var(--ph-palette-orange-500) 90%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.auth-layout__tagline {
  margin: 0;
  font-size: var(--ph-font-size-md);
  color: var(--ph-color-text-muted);
}

.auth-layout__card {
  width: 100%;
  max-width: 400px;
  padding: var(--ph-space-6);
  border-radius: var(--ph-radius-lg);
  background: var(--ph-color-glass-surface);
  border: 1px solid var(--ph-color-glass-border);
  backdrop-filter: var(--ph-glass-blur);
  -webkit-backdrop-filter: var(--ph-glass-blur);
  box-shadow: var(--ph-shadow-lg);
  animation: ph-auth-in var(--ph-duration-base) var(--ph-ease-out);
  animation-delay: 60ms;
  animation-fill-mode: backwards;
}

@keyframes ph-auth-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-layout__blob {
    animation: none;
  }
}
</style>
