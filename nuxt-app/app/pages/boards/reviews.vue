<!-- app/pages/boards/review.vue -->

<template>
  <div class="container">
    <div class="header">
      <h1>서비스 평가</h1>
      <div class="user-info">
        <span>{{ userName }}님 환영합니다</span>
      </div>
    </div>
    
    <div v-if="pending" class="loading">
      데이터를 불러오는 중...
    </div>
    
    <div v-else-if="error" class="error">
      오류가 발생했습니다: {{ error.message }}
    </div>
    
    <div v-else-if="data && data.success">
      <div class="board-info">
        전체 평가: {{ data.pagination.totalCount }}개 
        ({{ data.pagination.currentPage }} / {{ data.pagination.totalPages }} 페이지)
      </div>
      
      <table class="board-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>작성자</th>
            <th>내용</th>
            <th>별점</th>
            <th>등록일</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="board in data.data" :key="board.boardId">
            <td>{{ board.rownum }}</td>
            <td>{{ board.writer }}</td>
            <td class="title-cell">
              <a @click="goToView(board.boardId)" class="title-link">
                {{ board.content }}
              </a>
            </td>
            <td>{{ board.rating }}</td>
            <td>{{ formatDate(board.createdAt) }}</td>
            <td>
              <!-- 수정, 삭제 버튼은 작성자에게만 노출 -->
              <div v-if="board.writer === userName" class="row-actions">
                <button @click="goToEdit(board.boardId)" class="row-edit-btn">수정</button>
                <button @click="handleRowDelete(board.boardId)" class="row-delete-btn">삭제</button>
              </div>
              <span v-else class="no-access">-</span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="data.data.length === 0" class="no-data">
        등록된 평가가 없습니다.
      </div>
      
      <!-- 페이지네이션 -->
      <div v-if="data.pagination.totalPages > 1" class="pagination">
        <button 
          @click="goToPage(1)" 
          :disabled="currentPage === 1"
          class="page-btn"
        >
          처음
        </button>
        
        <button 
          @click="goToPage(currentPage - 1)" 
          :disabled="currentPage === 1"
          class="page-btn"
        >
          이전
        </button>
        
        <button
          v-for="pageNum in visiblePages"
          :key="pageNum"
          @click="goToPage(pageNum)"
          :class="['page-btn', { active: pageNum === currentPage }]"
        >
          {{ pageNum }}
        </button>
        
        <button 
          @click="goToPage(currentPage + 1)" 
          :disabled="currentPage === data.pagination.totalPages"
          class="page-btn"
        >
          다음
        </button>
        
        <button 
          @click="goToPage(data.pagination.totalPages)" 
          :disabled="currentPage === data.pagination.totalPages"
          class="page-btn"
        >
          마지막
        </button>
      </div>
      
      <!-- 하단 버튼 -->
      <div class="bottom-buttons">
        <button @click="goToWrite" class="write-btn">
          평가 등록
        </button>
        <button v-if="isLoggedIn" @click="handleLogout" class="logout-btn">
          로그아웃
        </button>
        <button v-else @click="goToLogin" class="login-redirect-btn">
          로그인
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>

const route = useRoute();
const router = useRouter();

const currentPage = computed(() => {
  return parseInt(route.query.page) || 1;
});

const { data, pending, error, refresh } = await useFetch('/api/boards/reviews', {
  query: {
    page: currentPage,
    limit: 10
  },
  watch: [currentPage]
});

// 반응형 변수로 유저 정보 추출
const userName = computed(() => data.value?.me?.userName);
const isLoggedIn = computed(() => data.value?.me?.isLoggedIn);

const goToPage = (page) => {
  router.push({ path: '/boards/reviews', query: { page } });
};

const goToWrite = () => {
  // 이미 작성했는지 확인 (1인 1평가)
  if (data.value?.me?.hasWritten) {
    alert('평가는 1인당 1번만 작성할 수 있습니다.\n이미 작성하신 평가를 수정해 주세요.');
    return; // 함수 종료 (페이지 이동 막음)
  }

  router.push('/boards/write');
};

const goToView = (boardId) => {
  router.push(`/boards/${boardId}`);
};

const handleLogout = async () => {
  // 1. 사용자에게 한 번 더 물어보기 (실수 방지)
  if (!confirm('로그아웃 하시겠습니까?')) return;
  
  try {
    // 2. 서버의 logout API 호출 (이때 서버에서 쿠키를 삭제함)
    const response = await $fetch('/api/auth/logout', {
      method: 'POST'
    });
    
    if (response.success) {
      // 3. 로그아웃 후 그 자리에 그대로 머물기 위해 새로고침 수행
      // 새로고침이 되면 server/api/boards/reviews API가 다시 호출되고, 
      // 서버는 쿠키가 없으니 isLoggedIn: false를 반환하여 UI가 자연스럽게 바뀜
      window.location.reload(); 
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('로그아웃 중 오류가 발생했습니다.');
  }
};

const goToLogin = () => {
  router.push('/auth/login');
};

const visiblePages = computed(() => {
  if (!data.value || !data.value.pagination) return [];
  
  const totalPages = data.value.pagination.totalPages;
  const current = currentPage.value;
  const pages = [];
  
  let startPage = Math.max(1, current - 2);
  let endPage = Math.min(totalPages, current + 2);
  
  if (current <= 3) {
    endPage = Math.min(5, totalPages);
  }
  
  if (current >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// 수정 페이지로 이동 (id를 경로에 넣어 전달)
const goToEdit = (boardId) => {
  router.push(`/boards/${boardId}?mode=edit`);
};

// 삭제 처리 함수
const handleRowDelete = async (boardId) => {
  if (!confirm('정말로 이 리뷰를 삭제하시겠습니까?')) return;

  try {
    // /api/boards/[id] 경로로 DELETE 요청 전송
    const response = await $fetch(`/api/boards/${boardId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      alert('삭제되었습니다.');
      refresh(); // useFetch로 가져온 데이터를 새로고침하여 목록 갱신
    } else {
      alert(response.error || '삭제 실패');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
};

</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1 {
  color: #333;
  margin: 0;
}

.user-info {
  color: #666;
  font-size: 14px;
}

.board-info {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  color: #666;
  font-size: 14px;
}

.board-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.board-table th,
.board-table td {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #ddd;
}

.board-table th {
  background-color: #4b5cfa;
  color: white;
  font-weight: bold;
}

.board-table tbody tr:hover {
  background-color: #f5f5f5;
}

.board-table td:first-child {
  width: 80px;
}

.board-table td:nth-child(2) {
  width: 120px;
}

.board-table td:nth-child(4) {
  width: 80px;
}

.board-table td:nth-child(5) {
  width: 120px;
}

.title-cell {
  text-align: left !important;
}

.title-link {
  color: #333;
  text-decoration: none;
  cursor: pointer;
}

.title-link:hover {
  color: #094cdb;
  text-decoration: underline;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 18px;
}

.error {
  padding: 20px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin: 20px 0;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 16px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 30px 0;
}

.page-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  background-color: white;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s;
  min-width: 40px;
}

.page-btn:hover:not(:disabled) {
  background-color: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.page-btn.active {
  background-color: #4CAF50;
  color: white;
  border-color: #4CAF50;
  font-weight: bold;
}

.page-btn:disabled {
  background-color: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.bottom-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.write-btn,
.logout-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.write-btn {
  background-color: #4CAF50;
  color: white;
}

.write-btn:hover {
  background-color: #45a049;
}

.logout-btn {
  background-color: #f44336;
  color: white;
}

.logout-btn:hover {
  background-color: #d32f2f;
}

.row-actions {
  display: flex;
  gap: 5px;
  justify-content: center;
}

.row-edit-btn, .row-delete-btn {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background-color: white;
  transition: all 0.2s;
}

.row-edit-btn {
  color: #2196F3;
  border-color: #2196F3;
}
.row-edit-btn:hover {
  background-color: #2196F3;
  color: white;
}

.row-delete-btn {
  color: #f44336;
  border-color: #f44336;
}
.row-delete-btn:hover {
  background-color: #f44336;
  color: white;
}

.no-access {
  color: #ccc;
  font-size: 12px;
}

.star-text {
  color: #f39c12;
  font-weight: bold;
}

.login-redirect-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  background-color: #4b5cfa;
  color: white;
  transition: background-color 0.3s;
}

.login-redirect-btn:hover {
  background-color: #3a4ad9;
}
</style>