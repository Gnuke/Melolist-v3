// src/api/acrcloud.js
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // .env 파일 로드

const generateAcrCloudSignature = ( stringToSign, apiSecret ) => {
    return crypto.createHmac('sha1', apiSecret ).update( stringToSign ).digest( 'base64' );
}

async function searchMusic(audioBase64) {
    try {
        const apiKey = process.env.ACRCLOUD_API_KEY;
        const apiSecret = process.env.ACRCLOUD_API_SECRET;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const sampleBytes = audioBuffer.length; // 파일 크기 계산

        const host = 'identify-ap-southeast-1.acrcloud.com';
        const endpoint = '/v1/identify';
        const timestamp = Math.floor(Date.now() / 1000);
        const dataType = 'audio';
        const signatureVersion = 1;

        const stringToSign = `POST\n${endpoint}\n${apiKey}\n${dataType}\n${signatureVersion}\n${timestamp}`;
        const signature = generateAcrCloudSignature(stringToSign, apiSecret); // HMAC 서명 생성

        const formData = new FormData();
        formData.append('sample', audioBuffer, 'recorded_audio.mp3');
        formData.append('data_type', dataType);
        formData.append('access_key', apiKey);
        formData.append('signature', signature);
        formData.append('timestamp', timestamp);
        formData.append('signature_version', signatureVersion);
        formData.append('sample_bytes', sampleBytes);

        const apiUrl = `https://${host}${endpoint}`;

        const config = {
            headers: {
               ...formData.getHeaders(), // FormData의 Content-Type 설정 사용
            },
        };

        const apiResponse = await axios.post( apiUrl, formData, config );

        return await apiResponse.data; // ACRCloud API 응답 반환
    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패'); // 에러 처리
    }
}

export { searchMusic };