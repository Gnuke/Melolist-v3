// server/api/auth/naver/callback.get.ts
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
    const clientId = config.naverClientId
    const clientSecret = config.naverClientSecret
    
    if (!clientId || !clientSecret) {
      console.error('Naver OAuth 설정이 없습니다.')
      return sendRedirect(event, '/auth/login?error=config_error')
    }
    
    // 3. Authorization Code를 Access Token으로 교환
    const tokenResponse = await $fetch<{
      access_token?: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
      error?: string
      error_description?: string
    }>('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      params: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        state: state
      }
    })
    
    // 토큰 에러 처리
    if (tokenResponse.error || !tokenResponse.access_token) {
      console.error('Naver 토큰 교환 실패:', tokenResponse.error_description || tokenResponse.error)
      return sendRedirect(event, '/auth/login?error=token_exchange_failed')
    }
    
    const accessToken = tokenResponse.access_token
    
    // 4. Access Token으로 사용자 정보 조회
    const userInfoResponse = await $fetch<{
      resultcode?: string
      message?: string
      response?: {
        id: string
        email?: string
        name?: string
        nickname?: string
        profile_image?: string
      }
    }>('https://openapi.naver.com/v1/nid/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    // 사용자 정보 에러 처리
    if (userInfoResponse.resultcode !== '00' || !userInfoResponse.response) {
      console.error('Naver 사용자 정보 조회 실패:', userInfoResponse.message)
      return sendRedirect(event, '/auth/login?error=user_info_failed')
    }
    
    // 네이버 응답 구조: response 객체에 사용자 정보
    const naverUser = userInfoResponse.response
    
    // 5. DB에서 회원 조회 또는 생성 (Just-in-time 가입)
    let member = await prisma.member.findFirst({
      where: {
        provider: 'naver',
        providerUserId: naverUser.id
      }
    })
    
    // 없으면 생성
    if (!member) {
      // 이메일에서 @ 앞부분 추출 (예: k30ehs6@naver.com -> k30ehs6)
      let displayName = null
      if (naverUser.email) {
        displayName = naverUser.email.split('@')[0]
      } else {
        displayName = naverUser.name || naverUser.nickname || null
      }
      
      member = await prisma.member.create({
        data: {
          provider: 'naver',
          providerUserId: naverUser.id,
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
    setCookie(event, 'auth_token', `naver_${member.id}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7
    })
    
    // 6. 메인 페이지로 리디렉션
    return sendRedirect(event, '/')
    
  } catch (error: any) {
    console.error('Naver OAuth 에러:', error)
    return sendRedirect(event, '/auth/login?error=oauth_failed')
  }
})
