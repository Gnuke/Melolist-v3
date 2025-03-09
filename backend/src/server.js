import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'; // .env 파일 로드 (개발 환경에서만 사용)
import { searchMusicWithFingerprint } from './api/fingerprint.js';
import { searchMusicWithHumming } from "./api/humming.js";

const app = express();

// 개발 환경에서만 dotenv 사용
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

// CORS 활성화 (개발 환경에서는 모든 도메인 허용, 프로덕션에서는 특정 도메인만 허용하도록 vercel.json에 설정 권장)
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Fingerprint API 엔드포인트
app.post('/api/fingerprints', async (req, res) => { // API 경로 변경
    try {
        const audioBase64 = req.body.audio;
        const acrResponse = await searchMusicWithFingerprint(audioBase64);
        res.json(acrResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'ACRCloud API 요청 실패' });
    }
});

// Humming API 엔드포인트
app.post('/api/humming', async (req, res) => { // API 경로 변경
    try {
        const audioBase64 = req.body.audio;
        const acrResponse = await searchMusicWithHumming(audioBase64);
        res.json(acrResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Humming API 요청 실패' });
    }
});

export default app;