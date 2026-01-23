// server/api/fingerprints.post.ts

import { searchMusicWithFingerprint } from '../services/musicsearch/fingerprint.js';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ audio?: string }>(event)
  const audio = body?.audio

  if (!audio) {
    setResponseStatus(event, 400)
    return { error: '오디오 데이터가 필요합니다.' }
  }

  try {
    const acrResponse = await searchMusicWithFingerprint(audio)
    return acrResponse
  } catch (error) {
    console.error('Fingerprint API 요청 실패:', error)
    setResponseStatus(event, 500)
    return { error: 'ACRCloud API 요청 실패' }
  }
})