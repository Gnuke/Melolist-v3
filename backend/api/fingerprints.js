import { searchMusicWithFingerprint } from '../src/api/fingerprint.js';

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://melolist-xi.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST 요청 처리
    if (req.method === 'POST') {
        try {
            const { audio } = req.body;
            if (!audio) {
                return res.status(400).json({ error: '오디오 데이터가 필요합니다.' });
            }

            const acrResponse = await searchMusicWithFingerprint(audio);
            return res.status(200).json(acrResponse);
        } catch (error) {
            console.error('Fingerprint API 요청 실패:', error);
            return res.status(500).json({ error: 'ACRCloud API 요청 실패' });
        }
    }

    // 다른 메소드는 405 반환
    return res.status(405).json({ error: '허용되지 않는 메소드' });
}