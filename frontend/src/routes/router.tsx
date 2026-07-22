import { createBrowserRouter, Outlet } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LoginPage } from '@/pages/LoginPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { PlaylistsPage } from '@/pages/PlaylistsPage'
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { BottomNav } from '@/components/BottomNav'

/** 탭 화면(홈·즐겨찾기·플레이리스트·기록)에만 하단 내비 — 검색 플로우·로그인은 몰입 유지로 제외. */
function TabLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <TabLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/playlists', element: <PlaylistsPage /> },
      { path: '/playlists/:id', element: <PlaylistDetailPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  { path: '/search/:mode', element: <SearchPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    // 어드민(spec 003) — URL 직접 접근 전용(앱 내 진입점 없음), lazy로 청크 분리해
    // 일반 사용자 번들 무영향. 접근 가드는 AdminLayout이 수행.
    path: '/admin',
    lazy: async () => ({ Component: (await import('@/pages/admin/AdminLayout')).AdminLayout }),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/admin/AdminDashboardPage')).AdminDashboardPage }) },
      { path: 'music', lazy: async () => ({ Component: (await import('@/pages/admin/AdminMusicPage')).AdminMusicPage }) },
      { path: 'users', lazy: async () => ({ Component: (await import('@/pages/admin/AdminUsersPage')).AdminUsersPage }) },
    ],
  },
])
