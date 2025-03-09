import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'; // .env 파일 로드 (개발 환경에서만 사용)
import { searchMusicWithFingerprint } from './api/fingerprint.js';
import { searchMusicWithHumming } from './api/humming.js';

const app = express();

// 개발 환경에서만 dotenv 사용
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

app.use(express.json({ limit: '5mb' }));

// CORS 설정
if (process.env.NODE_ENV === 'development') {
    app.use(cors()); // 개발 환경에서는 모든 요청 허용
} else {
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "https://melolist-xi.vercel.app");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            return res.sendStatus(204); // No Content 응답
        }
        next();
    });
}

// 🎵 Fingerprint API 엔드포인트
app.post('/api/fingerprints', async (req, res) => {
    try {
        const { audio } = req.body;
        if (!audio) {
            return res.status(400).json({ error: '오디오 데이터가 필요합니다.' });
        }

        const acrResponse = await searchMusicWithFingerprint(audio);
        res.json(acrResponse);
    } catch (error) {
        console.error('Fingerprint API 요청 실패:', error);
        res.status(500).json({ error: 'ACRCloud API 요청 실패' });
    }
});

// 🎤 Humming API 엔드포인트
app.post('/api/humming', async (req, res) => {
    try {
        const { audio } = req.body;
        if (!audio) {
            return res.status(400).json({ error: '오디오 데이터가 필요합니다.' });
        }

        const acrResponse = await searchMusicWithHumming(audio);
        res.json(acrResponse);
    } catch (error) {
        console.error('Humming API 요청 실패:', error);
        res.status(500).json({ error: 'Humming API 요청 실패' });
    }
});

// ✅ 개발 환경에서만 서버 실행
if (process.env.NODE_ENV === 'development') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

// Vercel 배포용 (기본적으로 export 필요)
export default app;