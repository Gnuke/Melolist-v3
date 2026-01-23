import { getDbPool } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    const id = event.context.params.id;
    
    const pool = getDbPool();

    // 서버에서 쿠키 읽기 (현재 사용자 확인)
    const userId = getCookie(event, 'user_id');
    
    // 작성자 확인
    const [rows] = await pool.query(
      'SELECT user_id as userId FROM wooriic_board b WHERE board_id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return {
        success: false,
        error: '작성한 서비스 평가를 찾을 수 없습니다.'
      };
    }
    
    if (String(rows[0].userId) !== String(userId)) {
      return {
        success: false,
        error: '삭제 권한이 없습니다.'
      };
    }
    
    // 평가 삭제
    await pool.query(
      'DELETE FROM wooriic_board WHERE board_id = ?',
      [id]
    );
    
    return {
      success: true,
      message: '평가가 삭제되었습니다.'
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});