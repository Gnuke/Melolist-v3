import { prisma } from '../utils/prisma'

export default defineNitroPlugin(async () => {
  // 서버 시작 시 DB 연결 테스트
  try {
    await prisma.$connect()
    console.log('✅ Prisma DB 연결 성공')
  } catch (error) {
    console.error('❌ Prisma DB 연결 실패:', error)
  }
})
