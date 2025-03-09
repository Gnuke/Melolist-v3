<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import RecordingModal from './RecordingModal.vue';
import WaveSurfer from 'wavesurfer.js';
import FingerprintRecognizer from "./recognizers/FingerprintRecognizer.vue";
import HummingRecognizer from "./recognizers/HummingRecognizer.vue";

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

// 현재 선택된 Recognizer 유형
const selectedRecognizer = ref('fingerprint'); // 문자열로 Recognizer 유형 관리

// Recognizer 유형 변경 함수
const setRecognizer = (type) => {
  selectedRecognizer.value = type;

  // 탭이 변경되면 녹음 데이터 초기화
  recordedAudio.value = null;
  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }
};

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

const stopRecording = (recognizerType) => {
  isRecording.value = false;

  // 녹음 종료 시 인터벌 정리
  clearInterval(intervalId);

  // 여기에서 recognizerType에 따라 처리 로직 분기
  if (recognizerType === 'humming') {
    // Humming 관련 로직
    console.log('humming 탭에서 녹음 중지');
  } else if (recognizerType === 'fingerprint') {
    // AcrCloud 관련 로직
    console.log('fingerprint 탭에서 녹음 중지');
  }
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
    <div class="tab-container">
      <button
          :class="{ 'tab-button': true, 'active': selectedRecognizer === 'fingerprint' }"
          @click="setRecognizer('fingerprint')"
      >
        <i class="fa-solid fa-headphones-simple"></i> 음악찾기
      </button>
      <button
          :class="{ 'tab-button': true, 'active': selectedRecognizer === 'humming' }"
          @click="setRecognizer('humming')"
      >
        <i class="fa-solid fa-microphone-lines"></i> 내가 부르기
      </button>
      <!-- 다른 Recognizer에 대한 버튼 추가 가능 -->
    </div>
    <div class="record-button-container">
      <button class="record-button" @click="startRecording">
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
  margin: 20px auto; /* Adjust margin for smaller screens */
  padding: 20px; /* Adjust padding for smaller screens */
  background-color: #f8f9fa;
  border-radius: 15px; /* Slightly smaller border-radius for smaller screens */
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08); /* Less shadow for smaller screens */
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Record button container */
.record-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 20px; /* Add some margin below the button */
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
  min-height: auto; /* Adjust min-height for smaller screens */
  overflow: auto;
  margin-top: 20px; /* Add some spacing */
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
  height: 100px; /* Adjust height for smaller screens */
}

/* Waveform Styles */
.waveform {
  height: 40px; /* Adjust waveform height */
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

.volume-control input[type="range"] {
  width: 80px; /* Smaller width */
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(to right, #007bff {{ volume * 100 }}%, #ced4da {{ volume * 100 }}%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
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
  margin-bottom: 20px; /* Less margin */
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

  .tab-container {
    margin-bottom: 30px;
  }

  .tab-button {
    padding: 14px 20px;
    font-size: 1.1rem;
  }

  .tab-button i {
    font-size: 1.2rem;
  }
}

@media (prefers-color-scheme: dark) {
  .record-container, .tab-container, .audio-title, .time-display, .tab-button, .tab-button.active {
    color: black !important; /* 텍스트 검은색 */
  }
}

</style>