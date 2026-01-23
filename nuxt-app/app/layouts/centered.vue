<!-- 화면 중앙정렬 layout -->

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
        min-height: 100vh; 
        display: flex; 
        flex-direction: column; 
    }

    .main {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 18px 16px;
    }

    .page { 
        width: 100%; 
        max-width: 960px; 
        transform: translateY(20px); 
    }
</style>
