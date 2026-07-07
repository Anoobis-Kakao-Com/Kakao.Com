// netlify/functions/geocode.js
// 기존 edge-functions/Address.js 로직을 그대로 이식한 Netlify Function(Node)입니다.
// Edge Function 환경에서는 @netlify/blobs(Node 전용 패키지)가 정상 동작하지 않아
// 이 함수를 Node 런타임(Netlify Functions)으로 전환했습니다.
// 프론트(index.html)에서 호출하는 URL 경로(/api/geocode)는 netlify.toml의
// 리다이렉트 설정으로 그대로 유지됩니다.

const { getStore } = require('@netlify/blobs');

const REGION1_FULL_NAME = {
    // 약칭 → 전체명
    '서울': '서울특별시',
    '부산': '부산광역시',
    '대구': '대구광역시',
    '인천': '인천광역시',
    '광주': '광주광역시',
    '대전': '대전광역시',
    '울산': '울산광역시',
    '세종': '세종특별자치시',
    '경기': '경기도',
    '강원': '강원특별자치도',
    '충북': '충청북도',
    '충남': '충청남도',
    '전북': '전북특별자치도',
    '전남': '전라남도',
    '경북': '경상북도',
    '경남': '경상남도',
    '제주': '제주특별자치도',
    // 전체명이 그대로 들어올 경우도 처리 (이미 올바른 값이면 그대로 반환)
    '서울특별시': '서울특별시',
    '부산광역시': '부산광역시',
    '대구광역시': '대구광역시',
    '인천광역시': '인천광역시',
    '광주광역시': '광주광역시',
    '대전광역시': '대전광역시',
    '울산광역시': '울산광역시',
    '세종특별자치시': '세종특별자치시',
    '경기도': '경기도',
    '강원특별자치도': '강원특별자치도',
    '충청북도': '충청북도',
    '충청남도': '충청남도',
    '전북특별자치도': '전북특별자치도',
    '전라남도': '전라남도',
    '경상북도': '경상북도',
    '경상남도': '경상남도',
    '제주특별자치도': '제주특별자치도',
};

function fullRegion1(region1) {
    if (!region1) return region1;
    return REGION1_FULL_NAME[region1] || region1;
}

function fixFullAddress(fullAddr, region1Short, region1Full) {
    if (!fullAddr || !region1Short || region1Short === region1Full) return fullAddr;
    if (fullAddr.indexOf(region1Short) === 0) {
        return region1Full + fullAddr.slice(region1Short.length);
    }
    return fullAddr;
}

function buildJibunStr(jibunAddress) {
    if (!jibunAddress) return null;
    const no = jibunAddress.mainAddressNo + (jibunAddress.subAddressNo ? `-${jibunAddress.subAddressNo}` : '');
    return (jibunAddress.region3 && no) ? `${jibunAddress.region3} ${no}` : null;
}

const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};

// Netlify Blobs에 저장할 스토어 이름 (geocode-latest 함수와 동일한 이름을 사용해야 함)
const STORE_NAME = 'geocode-cache';
const BLOB_KEY = 'latest';

async function saveLatest(payload) {
    try {
        const store = getStore(STORE_NAME);
        await store.setJSON(BLOB_KEY, {
            ...payload,
            savedAt: new Date().toISOString(),
        });
    } catch (e) {
        // 저장 실패는 조용히 무시한다 (모바일 응답 자체는 정상 반환되어야 함).
        console.error('geocode.js: Blobs 저장 실패', e && e.message);
    }
}

exports.handler = async function (event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: HEADERS, body: '' };
    }

    const params = event.queryStringParameters || {};
    const key = params.key;
    const x = params.x;
    const y = params.y;

    if (!key) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: '카카오 API 키(key)가 없습니다.' }) };
    }
    if (!x || !y) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'x(경도)와 y(위도) 파라미터가 필요합니다.' }) };
    }

    try {
        const kakaoRes = await fetch(
            `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}&input_coord=WGS84`,
            { headers: { 'Authorization': `KakaoAK ${key.replace(/[^\x00-\x7F]/g, '')}` } }
        );

        if (!kakaoRes.ok) {
            const errText = await kakaoRes.text();
            return { statusCode: kakaoRes.status, headers: HEADERS, body: JSON.stringify({ error: '카카오 API 오류', detail: errText }) };
        }

        const data = await kakaoRes.json();

        if (!data.documents || data.documents.length === 0) {
            const body = { address: null, message: '주소를 찾을 수 없습니다.' };
            return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
        }

        const doc = data.documents[0];

        const roadAddress = doc.road_address ? (() => {
            const region1Short = doc.road_address.region_1depth_name;
            const region1Full  = fullRegion1(region1Short);
            return {
                full:         fixFullAddress(doc.road_address.address_name, region1Short, region1Full),
                region1:      region1Full,
                region2:      doc.road_address.region_2depth_name,
                region3:      doc.road_address.region_3depth_name,
                roadName:     doc.road_address.road_name,
                buildingNo:   doc.road_address.main_building_no + (doc.road_address.sub_building_no ? `-${doc.road_address.sub_building_no}` : ''),
                buildingName: doc.road_address.building_name,
                zoneNo:       doc.road_address.zone_no,
            };
        })() : null;

        const jibunAddress = doc.address ? (() => {
            const region1Short = doc.address.region_1depth_name;
            const region1Full  = fullRegion1(region1Short);
            return {
                full:          fixFullAddress(doc.address.address_name, region1Short, region1Full),
                region1:       region1Full,
                region2:       doc.address.region_2depth_name,
                region3:       doc.address.region_3depth_name,
                mainAddressNo: doc.address.main_address_no,
                subAddressNo:  doc.address.sub_address_no,
            };
        })() : null;

        const jibunStr = buildJibunStr(jibunAddress);

        if (roadAddress) {
            const buildingName = roadAddress.buildingName || null;
            let display_line2 = null;

            if (jibunStr) {
                display_line2 = buildingName
                    ? `< ${buildingName} - ${jibunStr} >`
                    : `< ${jibunStr} >`;
            }

            const body = {
                road_address:  roadAddress,
                jibun_address: jibunAddress,
                display:       roadAddress.full,
                display_line2: display_line2,
            };
            await saveLatest(body);
            return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
        }

        const jibunFull = jibunAddress?.full || null;

        try {
            const searchRes = await fetch(
                `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(jibunFull)}&analyze_type=similar`,
                { headers: { 'Authorization': `KakaoAK ${key.replace(/[^\x00-\x7F]/g, '')}` } }
            );

            if (searchRes.ok) {
                const searchData = await searchRes.json();
                const hit = searchData.documents && searchData.documents.find(function(d) {
                    return d.road_address && d.road_address.road_name;
                });

                if (hit && hit.road_address) {
                    const r1Short = hit.road_address.region_1depth_name;
                    const r1Full  = fullRegion1(r1Short);
                    const roadOnly = `${r1Full} ${hit.road_address.region_2depth_name} ${hit.road_address.road_name}`.trim();
                    const display_line2 = jibunStr ? `< ${jibunStr} >` : null;

                    const body = {
                        road_address:  roadAddress,
                        jibun_address: jibunAddress,
                        display:       roadOnly,
                        display_line2: display_line2,
                    };
                    await saveLatest(body);
                    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
                }
            }
        } catch (_) {}

        const fallbackBody = {
            road_address:  null,
            jibun_address: jibunAddress,
            display:       jibunFull,
            display_line2: null,
        };
        await saveLatest(fallbackBody);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(fallbackBody) };

    } catch (e) {
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: '서버 내부 오류', detail: e.message }) };
    }
};
