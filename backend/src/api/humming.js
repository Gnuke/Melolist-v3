// src/api/humming.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { requestACRCloud } from './requestACRCloud.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function searchMusicWithHumming(audioBase64) {
    try {
        const apiKey = process.env.HUMMING_API_KEY;
        const apiSecret = process.env.HUMMING_API_SECRET;

        return await requestACRCloud(audioBase64, apiKey, apiSecret, 'humming'); // recognitionType 지정
    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패');
    }
}

export { searchMusicWithHumming };