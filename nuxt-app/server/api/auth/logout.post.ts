// server/api/auth/logout.post.ts
export default defineEventHandler((event) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0    // 즉시 만료시켜 삭제함
  };

  // 설정했던 모든 인증 쿠키 삭제
  deleteCookie(event, 'auth_token', cookieOptions);
  deleteCookie(event, 'user_name', cookieOptions);
  deleteCookie(event, 'user_id', cookieOptions);

  return { success: true };
});