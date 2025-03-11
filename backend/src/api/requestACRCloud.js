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
    const seen = {}; // Set 대신 object 사용

    for (const result of results) {
        const key = `${result.title}-${result.artists?.[0]?.name || 'unknown'}-${result.score}`;

        if (!seen[key]) { // object의 key 존재 여부 확인은 Set보다 빠름
            uniqueResults.push(result);
            seen[key] = true; // key를 object에 추가
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

            // 메타데이터 요청 개수 제한
            const maxMetadataRequests = 3;
            const metadataResults = data.metadata[recognitionType].slice(0, maxMetadataRequests);

            // 각 인식 결과에 대해 Metadata API 호출
            if (data.metadata[recognitionType] && data.metadata[recognitionType].length > 0) {
                // 1. Promise 배열 생성
                const metadataPromises = metadataResults
                    .filter(result => result.score > 0.5) // score 조건 추가
                    .map(async result => {
                        try {
                            let query = { track: result.title };
                            if (recognitionType === 'music') {
                                query.artists = result.artists.map(artist => artist.name);
                            }

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
                    });

                // 2. 모든 Promise가 완료될 때까지 기다림
                try {
                    console.log(`총 ${metadataPromises.length}개의 Metadata API 요청`);
                    await Promise.all(metadataPromises);
                } catch (error) {
                    console.error("Promise.all 에러:", error);
                    throw new Error("Metadata API 호출 중 에러 발생"); // 상위 함수로 에러를 던짐
                }

                return metadataResults;
            }
        }

        // metadataResults가 없는 경우 빈 배열 반환
        console.log("클라이언트에 반환하는 데이터 : 빈 배열");
        return [];

    } catch (error) {
        console.error(error);
        throw new Error('ACRCloud API 요청 실패');
    }
}

export { requestACRCloud };