// server/api/auth/me.get.ts
export default defineEventHandler((event) => {
  const userName = getCookie(event, 'user_name');
  const authToken = getCookie(event, 'auth_token');

  return {
    isLoggedIn: !!authToken,
    userName: userName || ''
  }
});