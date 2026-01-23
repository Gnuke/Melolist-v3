// server/services/musicsearch/fetchACRCloudMetadata.ts

type MetadataQuery = {
  track: string
  artists?: string[]
}

type MetadataResult = {
  url: string
} | null

function cleanQueryText(text: string): string {
  // 괄호(...) 내용 제거 + 앞뒤 공백 정리
  return text.replace(/\(.*?\)/g, '').trim()
}

function buildRequestQuery(query: MetadataQuery): Record<string, any> {
  const track = cleanQueryText(query.track)

  // 기존 코드가 "artists를 쪼개서 첫 번째 요소만" 사용했으니 동일하게 유지
  let artist: string | undefined
  if (query.artists?.length) {
    const first = query.artists
      .flatMap((artistString) =>
        artistString
          .split(',')
          .map((a) => cleanQueryText(a))
          .filter(Boolean)
      )[0]
    artist = first
  }

  return {
    track,
    ...(artist ? { artists: artist } : {}),
  }
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(id),
  }
}

export async function fetchACRCloudMetadata(
  query: MetadataQuery,
  metadataApiKey: string
): Promise<MetadataResult> {
  const host = 'eu-api-v2.acrcloud.com'
  const endpoint = '/api/external-metadata/tracks'
  const apiUrl = `https://${host}${endpoint}`

  const requestQuery = buildRequestQuery(query)

  console.log('=============================================')
  console.log('requestQuery 내용 : ' + JSON.stringify(requestQuery))
  console.log('=============================================')

  // 타임아웃 5초
  const timeoutMs = 5000
  const { signal, cancel } = withTimeout(timeoutMs)

  try {
    // $fetch는 query 옵션으로 URLSearchParams를 자동 구성
    const responseData: any = await $fetch(apiUrl, {
      method: 'GET',
      query: {
        query: JSON.stringify(requestQuery),
        format: 'json',
        platforms: 'youtube',
      },
      headers: {
        Authorization: `Bearer ${metadataApiKey}`,
      },
      signal,
    })

    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log('ACRCloud Metadata API 요청 성공:', JSON.stringify(responseData, null, 2))
      } catch (e) {
        console.error('ACRCloud Metadata API 요청 성공 로깅 실패', e)
      }
    }

    // axios: response.data => $fetch는 기본이 body json을 반환
    const youtubeUrl =
      responseData?.data?.[0]?.external_metadata?.youtube?.[0]?.link

    console.log('응답 데이터: ' + JSON.stringify(responseData))

    if (youtubeUrl) {
      const transformedYoutubeUrl = String(youtubeUrl).replace(/music\.youtube\.com/, 'youtube.com')
      console.log('변환된 유튜브 URL: ' + transformedYoutubeUrl)
      return { url: transformedYoutubeUrl }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('유튜브 정보가 없습니다.')
    }
    return null
  } catch (error: any) {
    // AbortError(타임아웃) 처리
    if (error?.name === 'AbortError') {
      console.log('요청 취소됨: 요청 타임아웃')
      return null
    }

    console.error('ACRCloud Metadata API 요청 실패:', error)
    throw error
  } finally {
    cancel()
  }
}