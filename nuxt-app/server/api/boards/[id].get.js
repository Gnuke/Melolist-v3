import { getDbPool } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    const id = event.context.params.id;
    const pool = getDbPool();
    
    // 1. 서버에서 쿠키 읽기 (현재 접속자 확인)
    const userId = getCookie(event, 'user_id');
    const userName = getCookie(event, 'user_name');

    // 2. 서비스 평가 상세 조회
    const [rows] = await pool.query(
      `SELECT 
        b.board_id as boardId,
        b.user_id as userId,
        u.display_name as writer,
        b.content,
        b.rating,
        b.created_at as createdAt
      FROM wooriic_board b
      left JOIN wooriic_user u
        ON b.user_id = u.user_id
      WHERE board_id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return {
        success: false,
        error: '서비스 평가를 찾을 수 없습니다.'
      };
    }
    
    // 3. 이전 평가 조회
    const [prevRows] = await pool.query(
      'SELECT board_id as boardId, rating, content FROM wooriic_board WHERE board_id < ? ORDER BY boardId DESC LIMIT 1',
      [id]
    );
    
    // 4. 다음 평가 조회
    const [nextRows] = await pool.query(
      'SELECT board_id as boardId, rating, content FROM wooriic_board WHERE board_id > ? ORDER BY boardId ASC LIMIT 1',
      [id]
    );
    
    // 5. 응답 데이터 구성
    return {
      success: true,
      data: rows[0],
      prev: prevRows.length > 0 ? prevRows[0] : null,
      next: nextRows.length > 0 ? nextRows[0] : null,
      // 현재 접속한 사용자의 정보를 함께 반환
      me: {
        isLoggedIn: !!userId,
        userId: userId || null,
        userName: userName || '손'
      }
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});