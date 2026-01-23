<!-- Footer -->

<template>
  <footer class="footer">
    <div class="inner">
      <p class="text">© {{ year }} Melolist</p>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear();
</script>

<style scoped>
.footer {
  border-top: 1px solid #eee;
  background: #fff;
  margin-top: 24px;
}

.inner {
  margin: 0 auto;
  padding: 16px;
}

.text {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}
</style>
