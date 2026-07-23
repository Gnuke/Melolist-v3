import { beforeEach, describe, expect, it } from 'vitest'
import { addRecentFind, getRecentFinds, type RecentFind } from './recentFinds'
import type { AcrResult } from './types'

const KEY = 'melolist.recent-finds'

function result(overrides: Partial<AcrResult> = {}): AcrResult {
  return {
    acrid: 'acr-1',
    title: 'Ditto',
    artists: [{ name: 'NewJeans' }],
    cover_url: 'https://img/cover.jpg',
    youtube_video_id: 'vid-1',
    youtube_url: 'https://youtube.com/watch?v=vid-1',
    ...overrides,
  }
}

describe('recentFinds', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('검색 결과를 기록하면 필드가 매핑되어 조회된다', () => {
    addRecentFind(result())

    const finds = getRecentFinds()

    expect(finds).toHaveLength(1)
    expect(finds[0]).toMatchObject({
      key: 'acr-1',
      title: 'Ditto',
      artist: 'NewJeans',
      coverUrl: 'https://img/cover.jpg',
      videoId: 'vid-1',
      youtubeUrl: 'https://youtube.com/watch?v=vid-1',
    })
  })

  it('같은 곡(acrid)을 다시 기록하면 중복 없이 맨 앞으로 온다', () => {
    addRecentFind(result({ acrid: 'acr-1', title: 'Ditto' }))
    addRecentFind(result({ acrid: 'acr-2', title: 'Hype Boy' }))
    addRecentFind(result({ acrid: 'acr-1', title: 'Ditto' }))

    const finds = getRecentFinds()

    expect(finds.map((f) => f.key)).toEqual(['acr-1', 'acr-2'])
  })

  it('최대 6개까지만 보관하고 가장 오래된 항목을 버린다', () => {
    for (let i = 1; i <= 7; i++) {
      addRecentFind(result({ acrid: `acr-${i}`, title: `곡 ${i}` }))
    }

    const finds = getRecentFinds()

    expect(finds).toHaveLength(6)
    expect(finds[0].key).toBe('acr-7')
    expect(finds.map((f) => f.key)).not.toContain('acr-1')
  })

  it('목업 결과(acrid mock-*)는 기록하지 않는다', () => {
    addRecentFind(result({ acrid: 'mock-1' }))

    expect(getRecentFinds()).toHaveLength(0)
  })

  it('제목이 없거나 공백이면 기록하지 않는다', () => {
    addRecentFind(result({ title: undefined }))
    addRecentFind(result({ title: '   ' }))

    expect(getRecentFinds()).toHaveLength(0)
  })

  it('아티스트가 없으면 "미상"으로 기록한다', () => {
    addRecentFind(result({ artists: undefined }))

    expect(getRecentFinds()[0].artist).toBe('미상')
  })

  it('acrid가 없으면 제목-아티스트 조합을 키로 쓴다', () => {
    addRecentFind(result({ acrid: undefined }))

    expect(getRecentFinds()[0].key).toBe('Ditto-NewJeans')
  })

  it('저장소에 남은 과거 목업 항목은 조회 시 걸러지고 저장소도 정리된다', () => {
    const stored: RecentFind[] = [
      { key: 'mock-old', title: '목업 곡', artist: '목업', at: 1 },
      { key: 'acr-real', title: '실곡', artist: '가수', at: 2 },
    ]
    localStorage.setItem(KEY, JSON.stringify(stored))

    const finds = getRecentFinds()

    expect(finds.map((f) => f.key)).toEqual(['acr-real'])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1)
  })

  it('저장소가 깨져 있어도 빈 배열을 반환한다', () => {
    localStorage.setItem(KEY, '{not-json')

    expect(getRecentFinds()).toEqual([])
  })

  it('배열이 아닌 값이 저장돼 있어도 빈 배열을 반환한다', () => {
    localStorage.setItem(KEY, JSON.stringify({ not: 'a list' }))

    expect(getRecentFinds()).toEqual([])
  })
})
