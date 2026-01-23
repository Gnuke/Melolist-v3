// server/api/humming.post.ts

import { searchMusicWithHumming } from '../services/musicsearch/humming.js';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ audio?: string }>(event)
  const audio = body?.audio

  if (!audio) {
    setResponseStatus(event, 400)
    return { error: '오디오 데이터가 필요합니다.' }
  }

  try {
    const acrResponse = await searchMusicWithHumming(audio)
    return acrResponse
  } catch (error) {
    console.error('Humming API 요청 실패:', error)
    setResponseStatus(event, 500)
    return { error: 'ACRCloud API 요청 실패' }
  }
})