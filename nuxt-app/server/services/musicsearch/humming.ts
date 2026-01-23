// server/services/musicsearch/humming.ts

import { requestACRCloud } from './requestACRCloud'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function searchMusicWithHumming(audioBase64: string) {
  try {
    const apiKey = requireEnv('HUMMING_API_KEY')
    const apiSecret = requireEnv('HUMMING_API_SECRET')

    return await requestACRCloud(audioBase64, apiKey, apiSecret, 'humming')
  } catch (error) {
    console.error(error)
    throw new Error('ACRCloud API 요청 실패')
  }
}
