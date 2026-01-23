<!-- default layout -->
<template>
  <div class="app">
    <AppHeader />

    <main class="main">
      <div class="page">
        <slot />
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;          /* 중요: 화면 높이 확보 */
  display: flex;              /* 중요 */
  flex-direction: column;     /* 중요 */
}

.main {
  flex: 1;                    /* 중요: 남는 높이 전부 차지 */
  display: flex;              /* 중요 */
  justify-content: center;    /* 좌우 중앙 */
  align-items: center;        /* 상하 중앙 */
  padding: 18px 16px;
}

/* 폭 유지용 */
.page {
  width: 100%;
  max-width: 960px;
}
</style>
