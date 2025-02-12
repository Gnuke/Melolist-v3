import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv' // .env 파일 로드
import { searchMusic } from './api/acrcloud.js';

const app = express();
const port = process.env.PORT || 3000;

dotenv.config(); //.env 파일 로드

app.use(cors()); // CORS 활성화 (개발 환경에서만 사용)
app.use(express.json({ limit: '5mb' })); // JSON 파싱 미들웨어 추가, 요청 크기 제한 설정

app.post('/acrcloud', async (req, res) => {
    try {
        const audioBase64 = req.body.audio; // 클라이언트에서 Base64 인코딩된 오디오 데이터 받기
        const data = await searchMusic(audioBase64); // ACRCloud API 호출 함수 사용
        res.json(data); // ACRCloud API 응답을 클라이언트로 전달
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'ACRCloud API 요청 실패' });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});