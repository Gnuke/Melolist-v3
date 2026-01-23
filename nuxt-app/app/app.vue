<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
  const { currentUser, mockLogin } = useAuthTest();

  onMounted(() => {
    if (import.meta.dev && !currentUser.value) {
      mockLogin(1); // 원하는 테스트 유저
    }
  });

  watch(
    () => currentUser.value,
    (user) => {
      if (user) {
        console.log("[APP] current user: ", user.display_name);
      } else {
        console.log( "undefined user" );
      }
    },
    { immediate: true }
  )
</script>
