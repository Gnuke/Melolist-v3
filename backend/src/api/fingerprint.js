import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { requestACRCloud } from './requestACRCloud.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 개발 환경에서만 dotenv 사용
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

async function searchMusicWithFingerprint(audioBase64) {
    try {
        const apiKey = process.env.FINGERPRINT_API_KEY;
        const apiSecret = process.env.FINGERPRINT_API_SECRET;

        return await requestACRCloud(audioBase64, apiKey, apiSecret, 'music'); // recognitionType 지정

    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패');
    }
}

export { searchMusicWithFingerprint };