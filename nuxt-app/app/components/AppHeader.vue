<!-- Header -->

<template>
  <header class="header">
    <div class="inner">
      <!-- Left: Logo -->
      <NuxtLink to="/" class="brand" aria-label="Go to home">
        <span class="logo" aria-hidden="true">🎵</span>
        <span class="title">Melolist</span>
      </NuxtLink>

      <!-- Right: Actions -->
      <nav class="actions" aria-label="Header actions">
        <NuxtLink to="/boards/reviews" class="btn btn-ghost">
          리뷰
        </NuxtLink>

        <button
          v-if="isLoggedIn"
          class="btn btn-solid"
          type="button"
          @click="onLogout"
        >
          로그아웃
        </button>

        <NuxtLink
          v-else
          to="/auth/login"
          class="btn btn-solid"
        >
          로그인
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>

<script setup>
const { currentUser, logout } = useAuthTest();

const isLoggedIn = computed(() => !!currentUser.value);

function onLogout() {
  logout();
  // "로그인 했을 때 가정"이라면 여기서 강제 이동 안 해도 되는데,
  // UX상 홈으로 보내는 게 자연스러움
  navigateTo("/");
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.inner {
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  font-size: 18px;
}

.title {
  font-weight: 800;
  letter-spacing: -0.2px;
  font-size: 18px;
}

.actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  text-decoration: none;
}

.btn-ghost {
  background: transparent;
  border-color: #e5e7eb;
  color: #111827;
}

.btn-solid {
  background: #111827;
  color: #fff;
}
</style>
