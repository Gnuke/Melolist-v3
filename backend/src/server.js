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

if (process.env.NODE_ENV === 'development') {
    app.use(cors());
} else {
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "https://melolist-xi.vercel.app");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.sendStatus(200);
        } else {
            next();
        }
    });
}

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

// 개발 환경에서만 서버 실행
if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

export default app;