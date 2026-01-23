<!-- app/components/RecordingModal.vue -->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

type RecognizerType = 'fingerprint' | 'humming'

const props = defineProps<{
  audioStream: MediaStream | null
  selectedRecognizer: RecognizerType
}>()

const emit = defineEmits<{
  (e: 'stop'): void
  (e: 'close'): void
  (e: 'save', audioBlob: Blob): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let audioContext: AudioContext | null = null
let mediaStreamSource: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null

const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<BlobPart[]>([])

let animationFrameId: number | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

const currentDate = ref('')
const formattedRecordingTime = ref('00:00')
const recordingTime = ref(0)
const isPaused = ref(false)

// ---- util
const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60).toString().padStart(2, '0')
  const seconds = Math.floor(time % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const startTimer = () => {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  intervalId = setInterval(() => {
    recordingTime.value++
    formattedRecordingTime.value = formatTime(recordingTime.value)
  }, 1000)
}

const stopTimer = () => {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

const stopDraw = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const draw = () => {
  if (!analyser || !canvasRef.value) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  analyser.getByteTimeDomainData(dataArray)

  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.lineWidth = 2
  ctx.strokeStyle = 'white'
  ctx.beginPath()

  const sliceWidth = canvas.width / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const value = dataArray[i] ?? 128
    const v = value / 128.0
    const y = (v * canvas.height) / 2

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += sliceWidth
  }

  ctx.lineTo(canvas.width, canvas.height / 2)
  ctx.stroke()

  animationFrameId = requestAnimationFrame(draw)
}

// 브라우저가 지원하는 mimeType 선택
const pickMimeType = (): string | undefined => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

const setup = async (stream: MediaStream) => {
  // 날짜 표시
  const now = new Date()
  currentDate.value = now.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })

  // timer reset/start
  recordingTime.value = 0
  formattedRecordingTime.value = '00:00'
  startTimer()

  // AudioContext + analyser
  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048

  mediaStreamSource = audioContext.createMediaStreamSource(stream)
  mediaStreamSource.connect(analyser)

  // canvas size
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvas.offsetWidth || 300
    canvas.height = 150
  }

  // MediaRecorder
  audioChunks.value = []
  const mimeType = pickMimeType()

  mediaRecorder.value = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

  mediaRecorder.value.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      audioChunks.value.push(event.data)
    }
  }

  mediaRecorder.value.start()
  draw()
}

const teardown = async () => {
  stopDraw()
  stopTimer()

  try {
    if (mediaStreamSource) {
      mediaStreamSource.disconnect()
      mediaStreamSource = null
    }
    analyser = null

    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }
  } catch {
    // ignore close errors
  }

  // MediaRecorder 정리 (스트림 stop은 부모에서 함)
  if (mediaRecorder.value) {
    // recording / paused 상태면 안전하게 stop
    if (mediaRecorder.value.state !== 'inactive') {
      try {
        mediaRecorder.value.stop()
      } catch {
        // ignore
      }
    }
    mediaRecorder.value.ondataavailable = null
    mediaRecorder.value.onstop = null
    mediaRecorder.value = null
  }
}

// ---- actions
const stopRecording = () => {
  stopTimer()
  stopDraw()

  const mr = mediaRecorder.value
  if (mr && mr.state !== 'inactive') {
    // stop 완료 후 blob 만들기
    mr.onstop = () => {
      const blob = new Blob(audioChunks.value, {
        type: mr.mimeType || 'audio/webm',
      })
      emit('save', blob)
      emit('stop')
      emit('close')
    }
    mr.stop()
    return
  }

  emit('stop')
  emit('close')
}

const togglePause = () => {
  const mr = mediaRecorder.value
  if (!mr || mr.state === 'inactive') return

  isPaused.value = !isPaused.value

  if (isPaused.value) {
    // pause
    stopTimer()
    stopDraw()
    try {
      mr.pause()
    } catch {}
  } else {
    // resume
    startTimer()
    try {
      mr.resume()
    } catch {}
    draw()
  }
}

// ---- lifecycle
onMounted(async () => {
  // v-if 조건이 있지만, 타입상 null 가능하니 방어
  if (!props.audioStream) {
    console.error('audioStream이 존재하지 않습니다.')
    emit('stop')
    emit('close')
    return
  }

  try {
    await setup(props.audioStream)
  } catch (e) {
    console.error('오디오 시각화/녹음 초기화 오류:', e)
    emit('stop')
    emit('close')
  }
})

// 부모가 stream을 바꿔끼우는 경우 대비(선택)
watch(
  () => props.audioStream,
  async (newStream, oldStream) => {
    if (newStream === oldStream) return
    await teardown()
    if (newStream) {
      await setup(newStream)
    }
  }
)

onBeforeUnmount(async () => {
  await teardown()
})
</script>

<template>
  <div class="modal">
    <div class="modal-content">
      <div class="top-info">
        <h2>녹음 중</h2>
        <p class="date">{{ currentDate }}</p>
      </div>

      <canvas ref="canvasRef" class="waveform"></canvas>

      <p class="recording-time">{{ formattedRecordingTime }}</p>

      <div class="controls">
        <button class="control-button pause" @click="togglePause">
          <i :class="isPaused ? 'fas fa-play' : 'fas fa-pause'"></i>
        </button>

        <button class="control-button stop" @click="stopRecording">
          <i class="fas fa-stop"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8); /* 배경색 변경 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* 다른 요소보다 항상 위에 표시 */
}

.modal-content {
  background-color: #fff; /* 밝은 배경색 */
  padding: 20px;
  border-radius: 15px; /* 둥근 모서리 */
  min-width: 350px; /* 적절한 최소 너비 */
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* 그림자 효과 */
}

/* 상단 정보 영역 스타일 */
.top-info {
  text-align: center;
  margin-bottom: 20px;
}

.top-info h2 {
  color: #333; /* 제목 색상 */
  font-size: 1.8em; /* 제목 크기 */
  margin-bottom: 5px;
}

.top-info .date {
  color: #777; /* 날짜 색상 */
  font-size: 0.9em; /* 날짜 크기 */
}

/* 파형 표시 영역 스타일 */
.waveform {
  width: 100%;
  height: 150px;
  background-color: #eee; /* 파형 배경색 */
  border-radius: 8px;
  margin-bottom: 20px;
}

/* 녹음 시간 표시 스타일 */
.recording-time {
  color: #555; /* 시간 색상 */
  font-size: 2.2em; /* 시간 크기 */
  margin-bottom: 30px;
}

/* 컨트롤 버튼 영역 스타일 */
.controls {
  display: flex;
  justify-content: space-around;
  width: 100%;
}

.control-button {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px; /* 아이콘 크기 */
  color: white;
  transition: transform 0.2s ease-in-out; /* 클릭 효과 */
}

.control-button:hover {
  transform: scale(1.1); /* 호버 시 약간 확대 */
}

/* 일시정지 버튼 스타일 */
.control-button.pause {
  background-color: #1acc22; /* 초록색 */
}

/* 정지 버튼 스타일 */
.control-button.stop {
  background-color: #dc3545; /* 빨간색 */
}

/* 아이콘 스타일 */
.control-button i {
  pointer-events: none;
}
</style>