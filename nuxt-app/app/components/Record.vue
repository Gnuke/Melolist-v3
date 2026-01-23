<!-- app/components/Record.vue -->

<script setup lang="ts">

import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import RecordingModal from './RecordingModal.vue';
import WaveSurfer from 'wavesurfer.js';
import FingerprintRecognizer from "./recognizers/FingerprintRecognizer.vue";
import HummingRecognizer from "./recognizers/HummingRecognizer.vue";

// alarm 관련(toast)---------------------------------------------------
const toastMessage = ref<string | null>(null)

function showToast(msg: string, ms = 3500) {
  toastMessage.value = msg
  window.setTimeout(() => {
    toastMessage.value = null
  }, ms)
}

function mapGetUserMediaError(err: unknown): string {
  const e = err as any
  const name = e?.name as string | undefined

  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '오디오 입력 장치(마이크)를 찾을 수 없습니다. 마이크 연결/설정을 확인해주세요.'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '마이크 권한이 거부되었습니다. 브라우저 사이트 설정에서 마이크 권한을 허용해주세요.'
    case 'NotReadableError':
    case 'TrackStartError':
      return '마이크에 접근할 수 없습니다. 다른 앱(Zoom/Teams 등)이 마이크를 점유 중인지 확인해주세요.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return '요청한 오디오 조건을 만족하는 장치가 없습니다.'
    case 'SecurityError':
      return '보안상 마이크 접근이 차단되었습니다. HTTPS 환경에서만 동작합니다.'
    default:
      return `녹음을 시작할 수 없습니다. (${name ?? 'UnknownError'})`
  }
}
//---------------------------------------------------------
type RecognizerType = 'fingerprint' | 'humming'

const isRecording = ref(false);
const audioStream = ref<MediaStream | null>(null);
const recordedAudio = ref<string | null>(null);
const waveformContainer = ref<HTMLElement | null>(null);
let wavesurfer: WaveSurfer | null = null;

const isPlaying = ref(false);
const currentTime = ref(0); // 현재 재생 시간
const duration = ref(0); // 총 재생 시간
const volume = ref(1);

const recordingTime = ref(0); // 녹음 시간 (Number 타입)
let intervalId: number | null = null;

// 현재 선택된 Recognizer 유형
const selectedRecognizer = ref<RecognizerType>('fingerprint'); // 문자열로 Recognizer 유형 관리

// Recognizer 유형 변경 함수
const setRecognizer = (type: 'fingerprint' | 'humming') => {
  selectedRecognizer.value = type;

  // 탭이 변경되면 녹음 데이터 초기화
  recordedAudio.value = null;
  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }
};

const startRecording = async () => {
  
  // 🔒 이미 녹음 중이면 중복 시작 방지
  if (isRecording.value) return
  
  try {
    // Recording 시작 시 기존 interval 정리
    if (intervalId !== null){
      window.clearInterval(intervalId)
      intervalId = null
    }

    // 1) API 존재 여부 (구형/특수 환경)
    if (!navigator?.mediaDevices?.getUserMedia) {
      showToast('이 브라우저에서는 녹음 기능을 지원하지 않습니다.')
      return
    }

    // 2) 장치 목록 확인(선택 사항이지만 NotFound 처리에 도움)
    const devices = await navigator.mediaDevices.enumerateDevices()
    const hasMic = devices.some((d) => d.kind === 'audioinput')
    if (!hasMic) {
      showToast('오디오 장치(마이크)가 없습니다. 마이크를 연결해 주세요.')
      return
    }

    // 3) getUserMedia
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioStream.value = stream
    isRecording.value = true

    recordedAudio.value = null
    if (wavesurfer) {
      wavesurfer.destroy()
      wavesurfer = null
    }

    recordingTime.value = 0
    currentTime.value = 0
    intervalId = window.setInterval(() => {
      recordingTime.value++
    }, 1000)
  } catch (error) {
    console.error('오디오 스트림 오류:', error)
    showToast(mapGetUserMediaError(error))
  }
}

const stopRecording = (): void => {
  const recognizerType = selectedRecognizer.value
  
  isRecording.value = false;

  // 녹음 종료 시 인터벌 정리
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }

  // 여기에서 recognizerType에 따라 처리 로직 분기
  if (recognizerType === 'humming') {
    // Humming 관련 로직
    console.log('humming 탭에서 녹음 중지');
  } else if (recognizerType === 'fingerprint') {
    // AcrCloud 관련 로직
    console.log('fingerprint 탭에서 녹음 중지');
  }

  // ✅ 마이크 트랙 종료
  const stream = audioStream.value
  if (stream) {
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
    audioStream.value = null
    console.log('녹음 중지')
  }
};

const handleSave = (audioBlob: Blob): void => {
  if (recordedAudio.value) {
    URL.revokeObjectURL(recordedAudio.value)
  }

  recordedAudio.value = URL.createObjectURL(audioBlob)
  nextTick(initWaveSurfer)
};

const initWaveSurfer = (): void => {
  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null
  }

  const container = waveformContainer.value
  const audioUrl = recordedAudio.value

  if (!container) {
    console.error('waveform container element not found.')
    return
  } else if (!audioUrl) {
    console.error('recorded audio url not found.')
    return
  }

  wavesurfer = WaveSurfer.create({
    container,
    waveColor: '#667eea', /* 파스텔 톤 보라색 */
    progressColor: '#ef5350', /* 포인트 색상 */
    barWidth: 2,
  })
  
  wavesurfer.load(audioUrl);

  wavesurfer.on('ready', () => {
    if (!wavesurfer) return
    const d = wavesurfer.getDuration()
    duration.value = Number.isFinite(d) ? d : 0
    console.log('durationValue:', d)
  })

  wavesurfer.on('audioprocess', () => {
    if (!wavesurfer) return
    currentTime.value = wavesurfer.getCurrentTime() || 0
  })

  wavesurfer.on('finish', () => {
    isPlaying.value = false
    currentTime.value = duration.value
  })
};

const togglePlay = () => {
  if (wavesurfer) {
    wavesurfer.playPause();
    isPlaying.value = !isPlaying.value;
  }
};

const setVolume = (newVolume: number) => {
  if (wavesurfer) {
    wavesurfer.setVolume(newVolume);
    volume.value = newVolume;
  }
};

const formatTime = (time: number) => {
  if (typeof time !== 'number' || isNaN(time)) {
    return '00:00';
  }
  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

onMounted(() => {
});

onBeforeUnmount(() => {
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }

  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }

  // 오브젝트 URL도 정리(권장)
  if (recordedAudio.value) {
    URL.revokeObjectURL(recordedAudio.value)
    recordedAudio.value = null
  }

  // 녹음 중 스트림도 정리(권장)
  const stream = audioStream.value
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    audioStream.value = null
  }
});
</script>

<template>
  <div class="record-container">
    <div class="tab-container">
      <button
          :class="{ 'tab-button': true, 'active': selectedRecognizer === 'fingerprint' }"
          @click="setRecognizer('fingerprint')"
      >
        <i class="fa-solid fa-headphones-simple"></i> 음악 찾기
      </button>
      <button
          :class="{ 'tab-button': true, 'active': selectedRecognizer === 'humming' }"
          @click="setRecognizer('humming')"
      >
        <i class="fa-solid fa-microphone-lines"></i> 직접 부르기
      </button>
      <!-- 다른 Recognizer에 대한 버튼 추가 가능 -->
    </div>
    <div class="record-button-container">
      <button class="record-button" @click="startRecording" :disabled="isRecording">
        <i class="fas fa-microphone"></i>
      </button>
    </div>

    <RecordingModal
        v-if="isRecording"
        :audioStream="audioStream"
        :recordingTime="recordingTime"
        :selectedRecognizer="selectedRecognizer"
        @stop="stopRecording"
        @save="handleSave"
    />

    <div v-if="recordedAudio" class="audio-player">
      <h3 class="audio-title">녹음된 파일</h3>

      <!-- 웨이브폼과 시간 표시를 묶는 컨테이너 -->
      <div class="waveform-time-container">
        <div ref="waveformContainer" class="waveform"></div>
        <div class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>
      <div class="audio-controls">
        <button class="play-button" @click="togglePlay">
          <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
        </button>

        <div class="volume-control">
          <i class="fas fa-volume-up"></i>
          <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              v-model.number="volume"
              @input="setVolume(volume)"
              :style="{
            background: 'linear-gradient(to right, #007bff ' + (volume * 100) + '%, #ced4da ' + (volume * 100) + '%)'
        }"
          />
        </div>
      </div>
      <!-- AcrCloudRecognizer 컴포넌트 -->
      <FingerprintRecognizer v-if="selectedRecognizer === 'fingerprint' &&
      recordedAudio" :recordedAudio="recordedAudio" />
      <!-- SoundHoundRecognizer 컴포넌트 -->
      <HummingRecognizer v-else-if="selectedRecognizer === 'humming' &&
      recordedAudio" :recordedAudio="recordedAudio" />
    </div>
    <div v-else>
      <h2>버튼을 눌러 녹음을 시작해주세요.</h2>
    </div>

    <div v-if="toastMessage" class="toast">
      {{ toastMessage }}
    </div>
  </div>
</template>

<style scoped>
/* Reset some default styles for consistency */
button {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  outline: none;
}

/* Main container styles */
.record-container {
  font-family: "Noto Sans KR", sans-serif;
  max-width: 600px;
  margin: 20px auto; /* Adjust margin for smaller screens */
  padding: 20px; /* Adjust padding for smaller screens */
  background-color: #f8f9fa;
  border-radius: 15px; /* Slightly smaller border-radius for smaller screens */
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08); /* Less shadow for smaller screens */
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* v-else 블록 내 h2 태그 스타일 */
.record-container > div > h2 { /* record-container의 자식인 div의 자식인 h2 */
  width: 100%; /* 컨테이너 너비에 맞춤 */
  word-wrap: break-word; /* 단어 단위로 줄 바꿈 */
  overflow-wrap: break-word; /* 긴 단어 또는 URL을 줄 바꿈 (최신 표준) */
  text-align: center; /* 텍스트 가운데 정렬 (선택 사항) */
  font-size: 1.2rem; /* 폰트 사이즈 조절 (선택 사항) */
}

/* 작은 화면을 위한 미디어 쿼리 */
@media (max-width: 470px) {
  .record-container > div > h2 {
    font-size: 1rem; /* 더 작은 화면에서 폰트 사이즈 조절 */
  }
}

@media (max-width: 348px) {
  .record-container > div > h2 {
    font-size: 0.9rem; /* 더 작은 화면에서 폰트 사이즈 조절 */
  }
}

/* Record button container */
.record-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

/* Record button styles */
.record-button {
  background-color: #dc3545;
  color: white;
  border-radius: 50%;
  width: 60px; /* Smaller button for smaller screens */
  height: 60px; /* Smaller button for smaller screens */
  font-size: 24px; /* Smaller font for smaller screens */
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2); /* Less shadow for smaller screens */
}

.record-button:hover {
  background-color: #c82333;
  transform: scale(1.05);
}

.record-button i {
  margin: 0;
}

/* Audio player styles */
.audio-player {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 300px; /* Adjust min-height for smaller screens */
  overflow: auto;
}

/* Audio title styles */
.audio-title {
  color: #495057;
  font-size: 1.5em; /* Smaller title for smaller screens */
  margin-bottom: 10px;
  font-weight: 500;
  letter-spacing: -0.05em;
}

/* Waveform & Time Container Styles */
.waveform-time-container {
  position: relative;
  width: 100%; /* Full width on smaller screens */
  max-width: 300px; /* Limit width on larger screens */
  min-height: 150px;
  height: auto; /* Adjust height for smaller screens */
}

/* Waveform Styles */
.waveform {
  height: 128px; /* Adjust waveform height */
}

/* Time Display Styles */
.time-display {
  position: absolute;
  bottom: 0;
  right: 0;
  color: #6c757d;
  font-size: 0.9em; /* Smaller font size */
  margin-top: 5px;
}

/* WaveSurfer 래퍼 요소 스타일 (::v-deep 제거) */
.waveform-container :deep(div.wrapper) {
  position: relative;
  overflow: hidden;
  border: 1px solid #ccc;
  border-radius: 5px;
}

/* WaveSurfer 재생 헤드 스타일 (세로선) */
.record-container .waveform-time-container :deep(div.wrapper .wavesurfer-cursor) {
  height: 20px !important; /* Shorter cursor for smaller waveform */
  border-left: 2px solid #ff5e57 !important;
}

/* Media Query for smaller screens */
@media (max-width: 767px) {
  .record-container .waveform-time-container :deep(div.wrapper .wavesurfer-cursor) {
    height: 15px !important; /* 더 작은 재생 헤드 높이 */
  }
}

/* 오디오 컨트롤 */
.audio-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 300px; /* Limit width for larger screens */
  padding: 10px 0;
  border-top: 1px solid #e9ecef;
  margin-top: 10px;
  margin-bottom: 10px;
}

/* Play/Pause button styles */
.play-button {
  background-color: #16be1d;
  color: white;
  border-radius: 10px; /* Slightly smaller */
  padding: 8px 12px; /* Adjust padding */
  font-size: 0.9em; /* Smaller font size */
  transition: background-color 0.3s ease, transform 0.3s ease;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.play-button:hover {
  background-color: #1acc22;
  transform: scale(1.05);
}

/* Volume control styles */
.volume-control {
  display: flex;
  align-items: center;
}

.volume-control i {
  margin-right: 5px;
  color: #868e96;
  font-size: 0.8em; /* Adjust icon size */
}

.volume-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 탭 컨테이너 스타일 */
.tab-container {
  display: flex;
  width: 100%;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* 탭 버튼 스타일 */
.tab-button {
  flex: 1;
  padding: 10px 15px; /* Adjust padding */
  border: none;
  background-color: #fff;
  color: #495057;
  font-size: 0.9rem; /* Smaller font size */
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-button:hover {
  background-color: #e9ecef;
}

/* 탭 버튼 아이콘 스타일 */
.tab-button i {
  margin-right: 5px;
  font-size: 1rem; /* Smaller icon size */
}

/* 선택된 탭 버튼 스타일 */
.tab-button.active {
  background-color: #F5F5DC;
  color: #000080;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); /* Adjust shadow */
}

/* 탭 버튼 호버 효과 */
.tab-button:hover {
  background-color: #E8E8D8;
}

/* Media Query for larger screens */
@media (min-width: 768px) {
  .record-container {
    margin: 50px auto;
    padding: 50px;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  }

  .record-button {
    width: 80px;
    height: 80px;
    font-size: 32px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }

  .audio-title {
    font-size: 2em;
    margin-bottom: 20px;
  }

  .waveform-time-container {
    width: 300px;
    height: 160px;
  }

  .waveform {
    height: 60px;
  }

  .time-display {
    font-size: 1.1em;
    margin-top: 10px;
  }

  .play-button {
    padding: 12px 17px;
    font-size: 1.0em;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }

  .volume-control i {
    font-size: 1em;
  }

  .volume-control input[type="range"] {
    width: 100px;
  }

  .tab-button {
    padding: 14px 20px;
    font-size: 1.1rem;
  }

  .tab-button i {
    font-size: 1.2rem;
  }
}

/* 미디어 쿼리 수정 */
@media (max-width: 348px) {
  .tab-button {
    font-size: 0.8rem; /* 더 작은 화면에서 폰트 사이즈 조절 */
  }
}

@media (prefers-color-scheme: dark) {
  .record-container, .tab-container, .audio-title, .time-display, .tab-button, .tab-button.active {
    color: black !important; /* 텍스트 검은색 */
  }
}

.toast{
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.85);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  z-index: 9999;
  max-width: 90vw;
  word-break: break-word;
}
</style>