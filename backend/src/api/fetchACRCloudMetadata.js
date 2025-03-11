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

        const response = await axios.get(apiUrl, {
            params: {
                query: JSON.stringify(requestQuery), // 인코딩된 쿼리 전달
                format: 'json',
                platforms: 'youtube'
            },
            headers: {
                'Authorization': `Bearer ${metadataApiKey}`
            }
        });

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
        console.error('ACRCloud Metadata API 요청 실패:', error);
        throw error; // 오류를 다시 던짐
    }
};

export { fetchACRCloudMetadata };