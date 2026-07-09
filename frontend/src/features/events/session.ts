const KEY = 'melolist.session-id'

/** 탭 세션 UUID (KR3 "방문" 단위). 모든 API 요청에 X-Session-Id로 첨부된다. */
export function getSessionId(): string {
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}
