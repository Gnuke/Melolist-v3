import axios from 'axios'
import { supabase } from '@/lib/supabase'

/**
 * 백엔드(Spring) 호출용 Axios 인스턴스.
 * 요청마다 Supabase 세션의 access_token을 Bearer로 주입한다.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
