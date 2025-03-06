// src/api/requestACRCloud.js
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';

const generateAcrCloudSignature = (stringToSign, apiSecret) => {
    return crypto.createHmac('sha1', apiSecret).update(stringToSign).digest('base64');
};

// 중복 제거 함수
const removeDuplicateResults = (results) => {
    const uniqueResults = [];
    const seen = new Set();

    for (const result of results) {
        const key = `${result.title}-${result.artists[0]?.name}-${result.score}`;

        if (!seen.has(key)) {
            uniqueResults.push(result);
            seen.add(key);
        }
    }

    return uniqueResults;
};

async function requestACRCloud(audioBase64, apiKey, apiSecret, recognitionType = 'music') {
    try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const sampleBytes = audioBuffer.length;

        const host = 'identify-ap-southeast-1.acrcloud.com';
        const endpoint = '/v1/identify';
        const timestamp = Math.floor(Date.now() / 1000);
        const dataType = 'audio';
        const signatureVersion = 1;

        const stringToSign = `POST\n${endpoint}\n${apiKey}\n${dataType}\n${signatureVersion}\n${timestamp}`;
        const signature = generateAcrCloudSignature(stringToSign, apiSecret);

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
                ...formData.getHeaders(),
            },
        };

        const apiResponse = await axios.post(apiUrl, formData, config);
        const data = await apiResponse.data;

        // 데이터 중복 제거
        if (data && data.status.code === 0 && data.metadata && data.metadata[recognitionType]) {
            data.metadata[recognitionType] = removeDuplicateResults(data.metadata[recognitionType]);
        }

        return data;
    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패');
    }
}

export { requestACRCloud };