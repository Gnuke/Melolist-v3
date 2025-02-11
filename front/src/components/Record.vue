<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import RecordingModal from './RecordingModal.vue';
import WaveSurfer from 'wavesurfer.js';

const isRecording = ref(false);
const audioStream = ref(null);
const recordedAudio = ref(null);
const waveformContainer = ref(null);
let wavesurfer = null;

const isPlaying = ref(false);
const currentTime = ref(0); // 현재 재생 시간
const duration = ref(0); // 총 재생 시간
const volume = ref(1);

const recordingTime = ref(0); // 녹음 시간 (Number 타입)
let intervalId = null;

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream.value = stream;
    isRecording.value = true;

    // 데이터 초기화
    recordedAudio.value = null;
    if (wavesurfer) {
      wavesurfer.destroy();
      wavesurfer = null;
    }

    // 녹음 시작 시 녹음 시간 초기화 및 업데이트 시작
    recordingTime.value = 0;
    currentTime.value = 0;
    intervalId = setInterval(() => {
      recordingTime.value++;
    }, 1000);
  } catch (error) {
    console.error("오디오 스트림 오류:", error);
  }
};

const stopRecording = () => {
  isRecording.value = false;

  // 녹음 종료 시 인터벌 정리
  clearInterval(intervalId);
};

const handleSave = (audioBlob) => {
  recordedAudio.value = URL.createObjectURL(audioBlob);

  nextTick(() => {
    initWaveSurfer();
  });
};

const initWaveSurfer = () => {
  if (wavesurfer) {
    wavesurfer.destroy();
  }

  if(waveformContainer.value){
    wavesurfer = WaveSurfer.create({
      container: waveformContainer.value,
      waveColor: '#667eea', /* 파스텔 톤 보라색 */
      progressColor: '#ef5350', /* 포인트 색상 */
      barWidth: 2,
      responsive: true,
    });

    wavesurfer.load(recordedAudio.value);

    wavesurfer.on('ready', () => {
      const durationValue = wavesurfer.getDuration();
      duration.value = typeof durationValue === 'number' && !isNaN(durationValue) ? durationValue : 0;
      console.log("durationValue:", durationValue)
    });

    wavesurfer.on('audioprocess', () => {
      currentTime.value = wavesurfer.getCurrentTime() || 0;
    });

    wavesurfer.on('finish', () => {
      isPlaying.value = false;
      currentTime.value = duration.value;
    });
  }else{
    console.error("waveform container element not found.");
  }
};

const togglePlay = () => {
  if (wavesurfer) {
    wavesurfer.playPause();
    isPlaying.value = !isPlaying.value;
  }
};

const setVolume = (newVolume) => {
  if (wavesurfer) {
    wavesurfer.setVolume(newVolume);
    volume.value = newVolume;
  }
};

const formatTime = (time) => {
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
  clearInterval(intervalId);
  if (wavesurfer) {
    wavesurfer.destroy(); // 컴포넌트 언마운트 시 WaveSurfer 인스턴스 제거
  }
});
</script>

<template>
  <div class="record-container">
    <div class="record-button-container">
      <button class="record-button" @click="startRecording">
        <i class="fas fa-microphone"></i>
      </button>
    </div>

    <RecordingModal
        v-if="isRecording"
        :audioStream="audioStream"
        :recordingTime="recordingTime"
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
          />
        </div>
      </div>
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
  max-width: 800px;
  margin: 50px auto;
  padding: 50px;
  background-color: #f8f9fa;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Record button container */
.record-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
}

/* Record button styles */
.record-button {
  background-color: #dc3545;
  color: white;
  border-radius: 50%;
  width: 80px;
  height: 80px;
  font-size: 32px;
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.record-button:hover {
  background-color: #c82333;
  transform: scale(1.1);
}

.record-button i {
  margin: 0;
}

/* Audio player styles */
.audio-player {
  margin-top: 40px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Audio title styles */
.audio-title {
  color: #495057;
  font-size: 2em;
  margin-bottom: 20px;
  font-weight: 500;
  letter-spacing: -0.05em;
}

/* Waveform & Time Container Styles */
.waveform-time-container {
  position: relative;
  width: 600px; /* 웨이브폼 너비 설정 */
  margin-bottom: 20px;
}

/* Waveform Styles */
.waveform {
  height: 60px;
  /* 필요한 경우 웨이브폼 색상 등 추가 스타일 지정 */
}

/* Time Display Styles */
.time-display {
  position: absolute;
  bottom: 0;
  right: 0;
  color: #6c757d;
  font-size: 1.1em;
}

/* WaveSurfer 래퍼 요소 스타일 (::v-deep 제거) */
.waveform-container :deep(div.wrapper) {
  /* 원하는 스타일 적용 */
  position: relative;
  overflow: hidden; /* 필요한 경우 */
  border: 1px solid #ccc; /* 예시: 테두리 추가 */
  border-radius: 5px; /* 예시: 둥근 모서리 */
}

/* WaveSurfer 재생 헤드 스타일 (세로선) */
.waveform-container :deep(div.wrapper .wavesurfer-cursor) {
  height: 30px !important;
  border-left: 2px solid #ff5e57 !important;
}

/* 오디오 컨트롤 */
.audio-controls {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 30px 0;
  border-top: 1px solid #e9ecef;
  margin-top: 20px;
}

/* Play/Pause button styles */
.play-button {
  background-color: #007bff;
  color: white;
  border-radius: 12px;
  padding: 15px 25px;
  font-size: 1.1em;
  transition: background-color 0.3s ease, transform 0.3s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.play-button:hover {
  background-color: #0069d9;
  transform: scale(1.05);
}

.play-button i {
  margin-right: 10px;
}

/* Volume control styles */
.volume-control {
  display: flex;
  align-items: center;
}

.volume-control i {
  margin-right: 10px;
  color: #868e96;
}

.volume-control input[type="range"] {
  width: 150px;
  height: 6px;
  border-radius: 5px;
  background: #ced4da;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.volume-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}
</style>