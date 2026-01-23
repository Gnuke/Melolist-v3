// server/services/musicsearch/fingerprint.ts

import { requestACRCloud } from './requestACRCloud'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function searchMusicWithFingerprint(audioBase64: string) {
  try {
    const apiKey = requireEnv('FINGERPRINT_API_KEY')
    const apiSecret = requireEnv('FINGERPRINT_API_SECRET')

    return await requestACRCloud(audioBase64, apiKey, apiSecret, 'music')
  } catch (error) {
    console.error(error)
    throw new Error('ACRCloud API 요청 실패')
  }
}
