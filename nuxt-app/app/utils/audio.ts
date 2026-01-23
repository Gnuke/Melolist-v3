// app/utils/audio.ts

export async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl)
  if (!res.ok) throw new Error(`Failed to fetch blob url: ${res.status}`)
  const blob = await res.blob()

  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // base64 인코딩
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}