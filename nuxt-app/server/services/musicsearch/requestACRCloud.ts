import crypto from 'crypto'
import { fetchACRCloudMetadata } from './fetchACRCloudMetadata'

type RecognitionType = 'music' | 'humming'

type AcrStatus = { code: number; msg?: string; version?: string }
type AcrArtist = { name: string }
export type AcrResult = {
  title: string
  score: number
  artists?: AcrArtist[]
  youtube_url?: string
  [key: string]: any
}
type AcrIdentifyResponse = { status: AcrStatus; metadata?: Record<string, AcrResult[]>; [k: string]: any }

const generateAcrCloudSignature = (stringToSign: string, apiSecret: string) =>
  crypto.createHmac('sha1', apiSecret).update(stringToSign).digest('base64')

const removeDuplicateResults = (results: AcrResult[]) => {
  const unique: AcrResult[] = []
  const seen: Record<string, boolean> = {}
  for (const r of results) {
    const key = `${r.title}-${r.artists?.[0]?.name || 'unknown'}`
    if (!seen[key]) { unique.push(r); seen[key] = true }
  }
  return unique
}

export async function requestACRCloud(
  audioBase64: string,
  apiKey: string,
  apiSecret: string,
  recognitionType: RecognitionType = 'music'
): Promise<AcrResult[]> {
  // ✅ base64 prefix 제거 (있으면)
  const pureBase64 = audioBase64.includes('base64,')
    ? audioBase64.split('base64,')[1]
    : audioBase64

  const audioBuffer = Buffer.from(pureBase64, 'base64')
  const sampleBytes = audioBuffer.length

  const host = process.env.ACRCLOUD_IDENTIFY_HOST || 'identify-ap-southeast-1.acrcloud.com'
  const endpoint = '/v1/identify'
  const apiUrl = `https://${host}${endpoint}`

  const timestamp = Math.floor(Date.now() / 1000)
  const dataType = 'audio'
  const signatureVersion = 1

  const stringToSign = `POST\n${endpoint}\n${apiKey}\n${dataType}\n${signatureVersion}\n${timestamp}`
  const signature = generateAcrCloudSignature(stringToSign, apiSecret)

  // ✅ 네이티브 FormData/Blob 사용 (npm form-data X)
  const form = new FormData()
  form.append('sample', new Blob([audioBuffer]), 'recorded_audio.wav')
  form.append('data_type', dataType)
  form.append('access_key', apiKey)
  form.append('signature', signature)
  form.append('timestamp', String(timestamp))
  form.append('signature_version', String(signatureVersion))
  form.append('sample_bytes', String(sampleBytes))

  console.log('[ACR] sending', { recognitionType, sampleBytes, host })

  // ✅ Node fetch로 응답을 "텍스트로" 받아 JSON 파싱
  const res = await fetch(apiUrl, { method: 'POST', body: form })
  const text = await res.text()

  console.log('[ACR] http', res.status, res.statusText)
  console.log('[ACR] raw preview', text.slice(0, 200))

  let data: AcrIdentifyResponse
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`ACRCloud non-JSON response: ${text.slice(0, 200)}`)
  }

  console.log('[ACR] status', data?.status)

  const list = data?.metadata?.[recognitionType]
  if (data?.status?.code === 0 && Array.isArray(list) && list.length > 0) {
    const deduped = removeDuplicateResults(list)
    const top = deduped.slice(0, 3)

    await Promise.all(
      top
        .filter(r => r.score > 0.5)
        .map(async (r) => {
          const query: { track: string; artists?: string[] } = { track: r.title }
          if (recognitionType === 'music' && r.artists?.length) {
            query.artists = r.artists.map(a => a.name)
          }

          const metadataApiKey = process.env[`METADATA_API_KEY_${recognitionType.toUpperCase()}`]
          if (!metadataApiKey) return

          const meta = await fetchACRCloudMetadata(query, metadataApiKey)
          if (meta?.url) r.youtube_url = meta.url
        })
    )

    return top
  }

  console.log('클라이언트에 반환하는 데이터 : 빈 배열')
  return []
}