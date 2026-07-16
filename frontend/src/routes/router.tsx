import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LoginPage } from '@/pages/LoginPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { HistoryPage } from '@/pages/HistoryPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/search/:mode', element: <SearchPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/history', element: <HistoryPage /> },
])
