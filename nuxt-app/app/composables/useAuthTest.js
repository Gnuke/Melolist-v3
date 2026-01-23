// Mock data 사용 로그인 service

import { users } from "~~/mocks/db/users";

const MOCK_STORAGE_KEY = "melolist_mock_session";

export function useAuthTest() {
  const session = useState("session", () => {
    if (import.meta.client) {
      const raw = localStorage.getItem(MOCK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  });

  const currentUser = computed(() => session.value?.user ?? null);

  function persist() {
    if (!import.meta.client) return;
    if (session.value) localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(session.value));
    else localStorage.removeItem(MOCK_STORAGE_KEY);
  }

  // 지금은 OAuth 대신 "유저 선택 로그인" (팀원이 OAuth 붙이면 여기만 교체)
  function mockLogin(userId = 1) {
    const user = users.find((u) => u.user_id === userId) ?? users[0];
    session.value = {
      accessToken: "mock-token",
      user,
    };
    persist();
  }

  function logout() {
    session.value = null;
    persist();
  }

  return { session, currentUser, mockLogin, logout };
}