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
// 서버에서 실제 인증 상태 확인
const { data: authData, refresh } = await useFetch('/api/auth/me');

const isLoggedIn = computed(() => authData.value?.isLoggedIn || false);

async function onLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  
  try {
    // 서버의 logout API 호출 (쿠키 삭제)
    const response = await $fetch('/api/auth/logout', {
      method: 'POST'
    });
    
    if (response.success) {
      // 인증 상태 새로고침
      await refresh();
      // 홈으로 이동
      navigateTo("/");
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('로그아웃 중 오류가 발생했습니다.');
  }
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
