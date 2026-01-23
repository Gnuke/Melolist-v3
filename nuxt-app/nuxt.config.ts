// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: [
    '@fortawesome/fontawesome-free/css/all.min.css'
  ],
  runtimeConfig: {
    // 서버 사이드만 접근 가능
    //NAVER
    naverClientId: process.env.NAVER_CLIENT_ID,
    naverClientSecret: process.env.NAVER_CLIENT_SECRET,
    //GOOGLE
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    
    public: {
      // 클라이언트에서도 접근 가능
      //NAVER
      naverClientId: process.env.NAVER_CLIENT_ID,
      //GOOGLE
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID
    }
  }
})
