import { getDbPool } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    // 쿠키로 데이터 가져오기
    const authToken = getCookie(event, 'auth_token');
    const userName = getCookie(event, 'user_name');
    const userId = getCookie(event, 'user_id');

    const query = getQuery(event);
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const pool = getDbPool();
    
    // 전체 평가 수 조회
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM wooriic_board'
    );
    const totalCount = countResult[0].total;
    
    // 페이지별 데이터 조회 (번호는 내림차순으로 계산)
    const [rows] = await pool.query(
      `SELECT 
        b1.board_id as boardId,
        b1.user_id as userId,
        u1.display_name as writer,
        b1.content,
        b1.rating,
        b1.created_at as createdAt,
        (SELECT COUNT(*) FROM wooriic_board) - (
          SELECT COUNT(*) FROM wooriic_board b2 WHERE b2.board_id > b1.board_id
        ) AS rownum
      FROM wooriic_board b1
      left JOIN wooriic_user u1
        ON b1.user_id = u1.user_id
      ORDER BY board_id DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // 현재 사용자가 이미 작성했는지 확인 (1인 1평가)
    let hasWritten = false;
    if (userId) {
      const [checkRows] = await pool.query(
        `SELECT COUNT(*) as count 
        FROM wooriic_board b
        JOIN wooriic_user u ON b.user_id = u.user_id
        WHERE u.user_id = ?`,
        [userId]
      );
      hasWritten = checkRows[0].count > 0;
    }
    
    return {
      success: true,
      data: rows,
      pagination: {
        currentPage: page,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        limit: limit
      },
      // 현재 요청을 보낸 사용자의 정보를 응답에 포함
      me: {
        isLoggedIn: !!authToken,
        userName: userName || '손',
        userId: userId || null,
        hasWritten: hasWritten
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