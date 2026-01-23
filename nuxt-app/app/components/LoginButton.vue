<script setup lang="ts">
const isLoggedIn = ref(false);
const userName = ref('');

const handleLogin = () => {
  // TODO: OAuth 로그인 로직 구현 (Google, Naver)
  console.log('로그인 버튼 클릭');
  // 임시로 로그인 상태 변경
  isLoggedIn.value = true;
  userName.value = '사용자';
};

const handleLogout = () => {
  isLoggedIn.value = false;
  userName.value = '';
};

// 외부에서 사용할 수 있도록 expose
defineExpose({
  isLoggedIn,
  userName
});
</script>

<template>
  <div class="auth-section">
    <div v-if="isLoggedIn" class="user-info">
      <span class="user-name">{{ userName }}님</span>
      <button @click="handleLogout" class="logout-btn">
        <i class="fas fa-sign-out-alt"></i> 로그아웃
      </button>
    </div>
    <button v-else @click="handleLogin" class="login-btn">
      <i class="fas fa-sign-in-alt"></i> 로그인
    </button>
  </div>
</template>
