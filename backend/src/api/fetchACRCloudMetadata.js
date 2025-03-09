// src/api/fetchACRCloudMetadata.js
import axios from 'axios';

const fetchACRCloudMetadata = async (query, metadataApiKey) => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            try {
                console.log("metadata query : " + JSON.stringify(query));
            } catch (e) {
                console.error("metadata query 로깅 실패", e);
            }
        }

        const host = 'eu-api-v2.acrcloud.com';
        const endpoint = '/api/external-metadata/tracks';
        const apiUrl = `https://${host}${endpoint}`;

        let requestQuery = {}; // 요청 쿼리를 저장할 변수

        if (query.artists) { // 아티스트 정보가 있는 경우 (fingerprint)
            requestQuery = {"track": `${query.track}`, "artist": `${query.artists}`};
        } else { // 아티스트 정보가 없는 경우 (humming)
            requestQuery = {"track": `${query.track}`};
        }

        const config = {
            method: 'get',
            url: apiUrl,
            params: {
                query: JSON.stringify(requestQuery), // JSON 문자열로 변환
                format: 'json',
                platforms: 'youtube'
            },
            headers: {
                'Authorization': `Bearer ${metadataApiKey}`
            }
        };

        const response = await axios(config);

        if (process.env.NODE_ENV !== 'production') {
            try {
                console.log('ACRCloud Metadata API 요청 성공:', JSON.stringify(response.data, null, 2));
            } catch (e) {
                console.error("ACRCloud Metadata API 요청 성공 로깅 실패", e);
            }
        }

        // 구조 분해 할당 사용
        const { data: responseData } = response;
        if (responseData && responseData.data && responseData.data.length > 0) {
            const [metadata] = responseData.data;

            if (metadata?.external_metadata?.youtube?.[0]?.link) {
                // YouTube URL 추출
                let youtubeUrl = metadata.external_metadata.youtube[0].link;

                // YouTube Music URL을 일반 YouTube URL로 변환
                if (youtubeUrl.includes("music.youtube.com")) {
                    youtubeUrl = youtubeUrl.replace("music.youtube.com", "youtube.com");
                }

                return {
                    url: youtubeUrl
                };
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    console.log("유튜브 정보가 없습니다.");
                }
                return null;
            }
        } else {
            if (process.env.NODE_ENV !== 'production') {
                console.log("검색 결과가 없습니다.");
            }
            return null;
        }
    } catch (error) {
        console.error('ACRCloud Metadata API 요청 실패:', error);
        throw error; // 오류를 다시 던짐
    }
};

export { fetchACRCloudMetadata };