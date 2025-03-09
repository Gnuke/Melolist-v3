<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue';

const props = defineProps({
  audioStream: {
    type: MediaStream,
    required: true,
  },
  selectedRecognizer: {
    type: String,
    required: true,
  },
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
let intervalId = null; // setInterval 함수의 ID를 저장할 변수 추가
const recordingTime = ref(0); // 로컬 recordingTime 변수
const formattedRecordingTime = ref('00:00');

// 파형 데이터 저장용 변수 추가
const savedWaveformData = ref(null);

// 시간 업데이트 함수 (onMounted 스코프 밖으로 이동)
const updateTime = () => {
  recordingTime.value++; // 로컬 recordingTime 증가
  formattedRecordingTime.value = formatTime(recordingTime.value);
};

// 시간을 MM:SS 형식으로 변환하는 함수
const formatTime = (time) => {
  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

// draw 함수를 컴포넌트 스코프로 이동
const draw = () => {
  if (!analyser || !canvasRef.value) return; // analyser 또는 canvas가 없으면 중단
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

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
};

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

  // 1초마다 formattedRecordingTime 업데이트 (초기 실행)
  intervalId = setInterval(() => {
    updateTime();
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

    // MediaRecorder 설정 (녹음 데이터 저장)
    mediaRecorder.value = new MediaRecorder(props.audioStream);

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };
    mediaRecorder.value.start();

    // 최초 draw 호출
    draw();

  } catch (error) {
    console.error('오디오 시각화 오류:', error);
  }
});

const stopRecording = () => {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    // 이전 이벤트 리스너 제거
    mediaRecorder.value.onstop = null;

    mediaRecorder.value.stop();
    mediaRecorder.value.onstop = () => {
      const audioBlob = new Blob(audioChunks.value, {
        type: 'audio/mp3',
      });
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
    isPaused.value = !isPaused.value; // 일시정지 상태 반전

    if (isPaused.value) {
      // 일시정지 시
      clearInterval(intervalId);
      mediaRecorder.value.pause(); // 녹음 일시 정지
      cancelAnimationFrame(animationFrameId); // draw() 중단

      // 현재 파형 데이터 저장
      if (savedWaveformData.value && analyser && canvasRef.value) {
        const canvas = canvasRef.value;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;

        ctx.fillStyle = '#222'; // 배경색 변경
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white'; // 파형 색상 변경
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = savedWaveformData.value[i] / 128.0;
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
    } else {
      // 녹음 재개 시
      intervalId = setInterval(() => {
        updateTime();
      }, 1000);
      mediaRecorder.value.resume(); // 녹음 재개

      // 저장된 파형 데이터가 있으면 복원
      if (savedWaveformData.value) {
        const canvas = canvasRef.value;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;

        ctx.fillStyle = '#222'; // 배경색 변경
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white'; // 파형 색상 변경
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = savedWaveformData.value[i] / 128.0;
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
      // draw() 다시 시작
      draw();
    }
  }
}

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (mediaStreamSource) mediaStreamSource.disconnect();
  if (audioContext) audioContext.close();

  // MediaRecorder가 활성 상태인 경우 중지
  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    mediaRecorder.value.stop();
  }
  // unmount 시 interval 중단
  clearInterval(intervalId);
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
      <p class="recording-time">{{ formattedRecordingTime }}</p>

      <!-- 컨트롤 버튼 영역 -->
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