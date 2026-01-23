// server/api/boards/create.post.js
import { getDbPool } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // 1. 쿠키에서 직접 사용자 정보 가져오기
    const userId = getCookie(event, 'user_id');
    const authToken = getCookie(event, 'auth_token');
    // 로그인 여부 검증
    if (!authToken || !userId) {
      setResponseStatus(event, 401);
      return { success: false, error: '로그인이 필요한 서비스입니다.' };
    }

    // 2. 입력값 검증
    if (!body.rating || !body.content) {
      return { success: false, error: '별점과 내용을 입력해주세요.' };
    }
    
    const pool = getDbPool();
    
    // 3. DB 저장 (Default 컬럼 제외)
    const [result] = await pool.query(
      `INSERT INTO wooriic_board (user_id, rating, content) values (?, ?, ?)`,
      [userId, body.rating, body.content]
    );
    
    return {
      success: true,
      message: '서비스 평가가 등록되었습니다.',
      insertId: result.insertId
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      success: false,
      error: '저장 중 오류가 발생했습니다.'
    };
  }
});