import axios from 'axios';

const fetchACRCloudMetadata = async (query, metadataApiKey) => {
    try {
        const host = 'eu-api-v2.acrcloud.com';
        const endpoint = '/api/external-metadata/tracks';
        const apiUrl = `https://${host}${endpoint}`;

        const cleanQuery = (query) => {
            return query.replace(/\(.*?\)/g, "");
        };

        const requestQuery = {
            track: cleanQuery(query.track),
            ...(query.artists && {
                artists: query.artists.flatMap(artistString =>
                    artistString.split(',').map(artist => cleanQuery(artist.trim()))
                )[0] // 배열의 첫 번째 요소만 선택
            })
        };

        console.log("=============================================");
        console.log("requestQuery 내용 : " + JSON.stringify(requestQuery));
        console.log("=============================================");

        // 1. CancelToken 소스 생성
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();

        // 타임아웃 시간 (예: 5초)
        const timeout = 5000;

        // 타임아웃 설정
        const timeoutId = setTimeout(() => {
            source.cancel('요청 타임아웃'); // 타임아웃 시 요청 취소
        }, timeout);

        try {
            const response = await axios.get(apiUrl, {
                params: {
                    query: JSON.stringify(requestQuery), // 인코딩된 쿼리 전달
                    format: 'json',
                    platforms: 'youtube'
                },
                headers: {
                    'Authorization': `Bearer ${metadataApiKey}`
                },
                cancelToken: source.token // 2. CancelToken 연결
            });

            // 타임아웃 취소 (정상 응답 시)
            clearTimeout(timeoutId);

            if (process.env.NODE_ENV !== 'production') {
                try {
                    console.log('ACRCloud Metadata API 요청 성공:', JSON.stringify(response.data, null, 2));
                } catch (e) {
                    console.error("ACRCloud Metadata API 요청 성공 로깅 실패", e);
                }
            }

            const { data: responseData } = response;
            const youtubeUrl = responseData?.data?.[0]?.external_metadata?.youtube?.[0]?.link;

            console.log("응답 데이터: " + JSON.stringify(response.data));

            if (youtubeUrl) {
                let transformedYoutubeUrl = youtubeUrl.replace(/music\.youtube\.com/, "youtube.com"); // 정규식 사용
                console.log("변환된 유튜브 URL: " + transformedYoutubeUrl);
                return {
                    url: transformedYoutubeUrl
                };
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    console.log("유튜브 정보가 없습니다.");
                }
                return null;
            }
        } catch (error) {
            // 3. 에러 처리
            if (axios.isCancel(error)) {
                console.log('요청 취소됨:', error.message);
                // 여기서 사용자에게 타임아웃 알림을 줄 수 있습니다.
                return null; // 또는 다른 적절한 값 반환
            } else {
                console.error('ACRCloud Metadata API 요청 실패:', error);
                throw error; // 오류를 다시 던짐
            }
        } finally {
            // 에러가 발생하거나 정상적으로 응답을 받았을 때도 타임아웃을 취소해야 함
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error('ACRCloud Metadata API 요청 실패:', error);
        throw error; // 오류를 다시 던짐
    }
};

export { fetchACRCloudMetadata };