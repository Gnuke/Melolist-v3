#!/usr/bin/env node
/**
 * KR1 매칭률 측정 스크립트 (backend-prd §10, C6) — CI 무관 수동 실행.
 *
 * 테스트 곡 셋(오디오 + 정답)을 /api/search/{fingerprint|humming}에 투입해
 * Top-3 내 acrid 또는 제목-아티스트 일치를 판정하고, 모드별 매칭률과
 * KR1(지문 ≥80% · 허밍 ≥50%) 판정을 출력한다.
 *
 * 사용법:
 *   node match-rate.mjs [--base http://localhost:8080] [--manifest ./manifest.json]
 *                       [--only fingerprint|humming] [--delay 2000]
 *
 * manifest 형식은 manifest.example.json / README.md 참고.
 * 오디오 파일·리포트는 커밋하지 않는다(.gitignore — 원칙 IV 저작권 가드레일).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KR1_TARGET_PCT = { fingerprint: 80, humming: 50 }
const REQUEST_TIMEOUT_MS = 30_000

const args = parseArgs(process.argv.slice(2))
const BASE = (args.base ?? 'http://localhost:8080').replace(/\/$/, '')
const MANIFEST_PATH = resolve(HERE, args.manifest ?? './manifest.json')
const ONLY = args.only ?? null
const DELAY_MS = Number(args.delay ?? 2000) // ACRCloud 호출 간격 — 과금·레이트 보호

const MIME_BY_EXT = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1], i++
  }
  return out
}

/** 판정용 정규화 — 괄호 표기(리믹스/부제)·대소문자·공백 차이를 무시한다(v2 cleanQueryText 계승). */
function normalize(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** 한쪽이 다른 쪽을 포함하면 일치 — "끝사랑 (Last Love)" vs "끝사랑" 같은 표기 차 흡수. */
function looseMatch(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Top-3 판정 — acrid가 있으면 acrid 우선, 아니면 제목 AND 아티스트(§10). */
function judge(expected, results) {
  for (let rank = 0; rank < Math.min(results.length, 3); rank++) {
    const r = results[rank]
    if (expected.acrid && r.acrid === expected.acrid) return { hit: true, rank, matchedBy: 'acrid', r }
    const titleOk = looseMatch(expected.title, r.title)
    const artistOk =
      !expected.artist || (r.artists ?? []).some((a) => looseMatch(expected.artist, a?.name))
    if (titleOk && artistOk) return { hit: true, rank, matchedBy: 'title-artist', r }
  }
  return { hit: false, rank: null, matchedBy: null, r: results[0] ?? null }
}

async function searchOnce(track) {
  const filePath = resolve(dirname(MANIFEST_PATH), track.file)
  const ext = extname(filePath).toLowerCase()
  const blob = new Blob([readFileSync(filePath)], { type: MIME_BY_EXT[ext] ?? 'application/octet-stream' })
  const form = new FormData()
  form.append('audio', blob, basename(filePath))
  const res = await fetch(`${BASE}/api/search/${track.mode}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  return body?.results ?? []
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const pct = (hit, n) => (n === 0 ? 0 : Math.round((1000 * hit) / n) / 10)

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  let tracks = manifest.tracks ?? []
  if (ONLY) tracks = tracks.filter((t) => t.mode === ONLY)
  if (tracks.length === 0) {
    console.error('manifest에 대상 트랙이 없습니다.')
    process.exit(1)
  }

  console.log(`# 매칭률 측정 — ${BASE} · ${tracks.length}곡 · 간격 ${DELAY_MS}ms\n`)
  const rows = []
  for (const [i, track] of tracks.entries()) {
    let row
    try {
      const results = await searchOnce(track)
      const verdict = judge(track, results)
      row = {
        ...track,
        hit: verdict.hit,
        rank: verdict.rank,
        matchedBy: verdict.matchedBy,
        topResult: verdict.r ? `${verdict.r.title} — ${(verdict.r.artists ?? [])[0]?.name ?? '?'}` : '(무결과)',
        topScore: results[0]?.score ?? null,
        resultCount: results.length,
      }
    } catch (e) {
      row = { ...track, hit: false, rank: null, matchedBy: null, error: e.message }
    }
    rows.push(row)
    const mark = row.hit ? `HIT(rank ${row.rank})` : row.error ? `ERROR(${row.error})` : 'MISS'
    console.log(
      `[${String(i + 1).padStart(2)}/${tracks.length}] ${track.mode.padEnd(11)} ${track.title} — ${mark}` +
        (row.hit ? '' : row.error ? '' : ` (top: ${row.topResult})`),
    )
    if (i < tracks.length - 1) await delay(DELAY_MS)
  }

  const summary = {}
  for (const mode of ['fingerprint', 'humming']) {
    const of = rows.filter((r) => r.mode === mode)
    if (of.length === 0) continue
    const hits = of.filter((r) => r.hit).length
    summary[mode] = {
      n: of.length,
      hits,
      pct: pct(hits, of.length),
      target: KR1_TARGET_PCT[mode],
      pass: pct(hits, of.length) >= KR1_TARGET_PCT[mode],
    }
  }

  console.log('\n## 결과 (devlog/체크인에 붙여넣기)\n')
  console.log('| 모드 | 매칭 | 매칭률 | KR1 목표 | 판정 |')
  console.log('|---|---|---|---|---|')
  for (const [mode, s] of Object.entries(summary)) {
    console.log(`| ${mode} | ${s.hits}/${s.n} | ${s.pct}% | ≥${s.target}% | ${s.pass ? '✅' : '❌'} |`)
  }

  const reportsDir = resolve(HERE, 'reports')
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = resolve(reportsDir, `match-rate-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, summary, rows }, null, 2))
  console.log(`\n리포트 저장: ${reportPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
