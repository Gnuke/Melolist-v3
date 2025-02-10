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
      waveColor: '#4F4A85',
      progressColor: '#ff4757',
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
  <div>
    <button @click="startRecording">녹음 시작</button>

    <RecordingModal
        v-if="isRecording"
        :audioStream="audioStream"
        :recordingTime="recordingTime"
        @stop="stopRecording"
        @save="handleSave"
    />

    <div v-if="recordedAudio">
      <h3>녹음된 파일</h3>
      <div ref="waveformContainer"></div>

      <!-- 오디오 컨트롤러 UI -->
      <div class="audio-controls">
        <button @click="togglePlay">
          {{ isPlaying ? '일시 정지' : '재생' }}
        </button>

        <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="volume"
            @input="setVolume(volume)"
        />

        <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>  <!-- 포맷 적용 -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-controls {
  margin-top: 10px;
  display: flex;
  align-items: center;
}

.audio-controls button {
  margin-right: 10px;
}

.audio-controls input[type="range"] {
  width: 100px;
}
</style>