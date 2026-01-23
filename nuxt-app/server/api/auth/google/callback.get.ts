// server/api/auth/google/callback.get.ts
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // 1. Query에서 Authorization Code와 State 받기
  const query = getQuery(event)
  const code = query.code as string
  const state = query.state as string
  const error = query.error as string | undefined
  
  // 에러 처리
  if (error) {
    return sendRedirect(event, '/auth/login?error=' + encodeURIComponent(error))
  }
  
  if (!code || !state) {
    return sendRedirect(event, '/auth/login?error=invalid_request')
  }
  
  try {
    // 2. 환경 변수에서 Client ID와 Secret 가져오기
    const config = useRuntimeConfig()
    const clientId = config.public.googleClientId
    const clientSecret = config.googleClientSecret
    
    if (!clientId || !clientSecret) {
      console.error('Google OAuth 설정이 없습니다.')
      return sendRedirect(event, '/auth/login?error=config_error')
    }

    const redirectUri = `https://melolist-v2.vercel.app/api/auth/google/callback`
    
    // 3. Authorization Code를 Access Token으로 교환
    const tokenResponse = await $fetch<{
      access_token?: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
      id_token?: string
      error?: string
      error_description?: string
    }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }).toString()
    })
    
    // 토큰 에러 처리
    if (tokenResponse.error || !tokenResponse.access_token) {
      console.error('Google 토큰 교환 실패:', tokenResponse.error_description || tokenResponse.error)
      return sendRedirect(event, '/auth/login?error=token_exchange_failed')
    }
    
    const accessToken = tokenResponse.access_token
    
    // 4. Access Token으로 사용자 정보 조회
    const userInfoResponse = await $fetch<{
      id: string
      email?: string
      verified_email?: boolean
      name?: string
      given_name?: string
      family_name?: string
      picture?: string
      error?: {
        code?: number
        message?: string
      }
    }>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    // 사용자 정보 에러 처리
    if (userInfoResponse.error || !userInfoResponse.id) {
      console.error('Google 사용자 정보 조회 실패:', userInfoResponse.error?.message)
      return sendRedirect(event, '/auth/login?error=user_info_failed')
    }
    
    const googleUser = userInfoResponse
    
    // 5. DB에서 회원 조회 또는 생성 (Just-in-time 가입)
    let member = await prisma.member.findFirst({
      where: {
        provider: 'google',
        providerUserId: googleUser.id
      }
    })
    
    // 없으면 생성
    if (!member) {
      // 이메일에서 @ 앞부분 추출 (예: k30ehs6@gmail.com -> k30ehs6)
      let displayName = null
      if (googleUser.email) {
        displayName = googleUser.email.split('@')[0]
      } else {
        displayName = googleUser.name || `${googleUser.given_name || ''} ${googleUser.family_name || ''}`.trim() || null
      }
      
      member = await prisma.member.create({
        data: {
          provider: 'google',
          providerUserId: googleUser.id,
          displayName: displayName,
        }
      })
    }
    
    // 세션에 사용자 정보 저장
    // 로직 간편화를 위한 공통 이름 사용
    setCookie(event, 'user_id', member.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7일
    })
    
    setCookie(event, 'user_name', member.displayName || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7
    })
    
    // 로그인 토큰 설정 (기존 시스템과 호환)
    setCookie(event, 'auth_token', `google_${member.id}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7
    })
    
    // 6. 메인 페이지로 리디렉션
    return sendRedirect(event, '/')
    
  } catch (error: any) {
    console.error('Google OAuth 에러:', error)
    return sendRedirect(event, '/auth/login?error=oauth_failed')
  }
})
