<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue';

const props = defineProps({
  recordingTime: Number,
  audioStream: MediaStream,
});

const emit = defineEmits(['stop', 'close', 'save']);

let audioContext = null;
let mediaStreamSource = null;
let analyser = null;
const canvasRef = ref(null);
let animationFrameId = null;
const mediaRecorder = ref(null);
const audioChunks = ref([]);

const currentDate = ref('');
const currentTime = ref('');

const isPaused = ref(false);

const formattedRecordingTime = ref('00:00');

onMounted(async () => {
  if (!props.audioStream) {
    console.error("audioStream이 존재하지 않습니다.");
    return;
  }

  // 현재 날짜 및 시간 설정
  const now = new Date();
  currentDate.value = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  // 1초마다 formattedRecordingTime 업데이트
  setInterval(() => {
    formattedRecordingTime.value = formatTime(props.recordingTime);
  }, 1000);

  try {
    // 오디오 컨텍스트 생성
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    // 미디어 스트림 소스 연결
    mediaStreamSource = audioContext.createMediaStreamSource(props.audioStream);
    mediaStreamSource.connect(analyser);

    // 캔버스 설정
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;

    // 실시간 파형 업데이트
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!isPaused.value) { // 일시 정지 상태일 때는 파형 업데이트 중단
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#222'; // 배경색 변경
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white'; // 파형 색상 변경
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }
    draw();

    // MediaRecorder 설정 (녹음 데이터 저장)
    mediaRecorder.value = new MediaRecorder(props.audioStream);
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };
    mediaRecorder.value.start();

  } catch (error) {
    console.error('오디오 시각화 오류:', error);
  }
});

const stopRecording = () => {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop();
    mediaRecorder.value.onstop = () => {
      const audioBlob = new Blob(audioChunks.value, {type: 'audio/mp3'});
      emit('save', audioBlob); // Record.vue로 오디오 파일 전달
      emit('stop');
      emit('close');
    };
  } else {
    emit('stop');
    emit('close');
  }
};

const togglePause = () => {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    if (isPaused.value) {
      mediaRecorder.value.resume(); // 재개
    } else {
      mediaRecorder.value.pause(); // 일시 정지
    }
    isPaused.value = !isPaused.value;
  }
}

const formatTime = (time) => {
  // 시간을 0:00 형식으로 변환
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (mediaStreamSource) mediaStreamSource.disconnect();
  if (audioContext) audioContext.close();

  // MediaRecorder가 활성 상태인 경우 중지
  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    mediaRecorder.value.stop();
  }
});
</script>

<template>
  <div class="modal">
    <div class="modal-content">
      <!-- 상단 정보 영역 -->
      <div class="top-info">
        <h2>녹음 중</h2>
        <p class="date">{{ currentDate }}</p>
      </div>

      <!-- 파형 표시 영역 -->
      <canvas ref="canvasRef" class="waveform"></canvas>

      <!-- 녹음 시간 표시 -->
      <p class="recording-time">00:{{ recordingTime.toString().padStart(2, '0') }}</p>

      <!-- 컨트롤 버튼 영역 -->
      <div class="controls">
        <button
            class="control-button pause"
            :class="{ paused: isPaused }"
            @click="togglePause"
        ></button>
        <button class="control-button stop" @click="stopRecording"></button>
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
}

.modal-content {
  background-color: #222; /* 배경색 변경 */
  padding: 20px;
  border-radius: 10px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 상단 정보 영역 스타일 */
.top-info {
  text-align: center;
  margin-bottom: 20px;
}

.top-info h2 {
  color: white;
  font-size: 1.5em;
  margin-bottom: 5px;
}

.top-info .date {
  color: #999;
  font-size: 0.8em;
}

/* 파형 표시 영역 스타일 */
.waveform {
  width: 100%;
  height: 150px;
  background-color: #222;
  border-radius: 4px;
}

/* 녹음 시간 표시 스타일 */
.recording-time {
  color: white;
  font-size: 2em;
  margin-bottom: 20px;
}

/* 컨트롤 버튼 영역 스타일 */
.controls {
  display: flex;
  justify-content: space-around;
  width: 100%;
}

.control-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background-color: #444; /* 버튼 배경색 */
  background-size: 50%;
  background-repeat: no-repeat;
  background-position: center;
}

/* 각 버튼별 배경 이미지 설정 (이미지에 따라 변경) */
.control-button.pause {
  background-image: url('pause-icon.png'); /* 일시정지 아이콘 */
}

.control-button.stop {
  background-image: url('stop-icon.png'); /* 정지 아이콘 */
  background-color: #D32F2F; /* 정지 버튼 배경색 (빨간색) */
}
</style>