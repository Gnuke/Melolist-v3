// src/api/requestACRCloud.js
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import { fetchACRCloudMetadata } from "./fetchACRCloudMetadata.js";

const generateAcrCloudSignature = (stringToSign, apiSecret) => {
    return crypto.createHmac('sha1', apiSecret).update(stringToSign).digest('base64');
};

// 중복 제거 함수
const removeDuplicateResults = (results) => {
    const uniqueResults = [];
    const seen = new Set();

    for (const result of results) {
        const key = `${result.title}-${result.artists?.[0]?.name || 'unknown'}-${result.score}`;

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
            // 각 인식 결과에 대해 Metadata API 호출
            if (data.metadata[recognitionType] && data.metadata[recognitionType].length > 0) {
                for (const result of data.metadata[recognitionType]) {
                    try {
                        const query = recognitionType === 'music'
                            ? { track: result.title, artists: result.artists.map(artist => artist.name) }
                            : { track: result.title };

                        // 각 recognitionType에 맞는 API 키를 환경 변수에서 가져옴
                        const metadataApiKey = process.env[`METADATA_API_KEY_${recognitionType.toUpperCase()}`];

                        // ACRCloud Metadata API 호출 (fetchACRCloudMetadata에 query와 apiKey 전달)
                        const metadata = await fetchACRCloudMetadata(query, metadataApiKey);

                        // Metadata API 응답이 유효한 경우, 결과 객체에 추가
                        if (metadata) {
                            // YouTube URL 추가
                            result.youtube_url = metadata.url;
                        }
                    } catch (error) {
                        console.error("Metadata API 호출 실패:", error);
                        // 에러 처리 (계속 진행)
                    }
                }
            }
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log("================================")
            console.log("data : " + data.toString());
            console.log("================================")
        }

        return data;
    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패');
    }
}

export { requestACRCloud };