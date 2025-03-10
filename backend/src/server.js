import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchMusicWithFingerprint } from './api/fingerprint.js';
import { searchMusicWithHumming } from './api/humming.js';

const app = express();

// 개발 환경에서만 dotenv 사용
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

app.use(express.json({ limit: '5mb' }));

// CORS 설정 - Vercel 환경에서도 동작하도록 수정
app.use(cors({
    origin: ['https://melolist-xi.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// OPTIONS 요청을 위한 프리플라이트 핸들러
app.options('*', cors());

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