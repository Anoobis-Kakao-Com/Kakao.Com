import { getStore } from '@netlify/blobs';

// 모바일이 보낸 최신 주소 결과를 저장해 두고, 데스크탑은 이 값을 조회만 한다.
// (실제 조회 전용 엔드포인트는 Address-latest.js, 라우팅은 /api/geocode-latest)
const ADDRESS_STORE_NAME = 'location-cache';
const ADDRESS_STORE_KEY = 'geocode-latest';

async function saveLatestAddress(payload) {
    try {
        const store = getStore(ADDRESS_STORE_NAME);
        await store.setJSON(ADDRESS_STORE_KEY, {
            data: payload,
            savedAt: new Date().toISOString(),
        });
    } catch (e) {
        // 저장 실패는 기존 응답 흐름을 막지 않는다 (모바일 쪽 응답은 그대로 정상 반환).
        console.error('geocode-latest 저장 실패:', e && e.message);
    }
}

export default async function handler(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            }
        });
    }

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

    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const x   = url.searchParams.get('x');
    const y   = url.searchParams.get('y');

    const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (!key) return new Response(JSON.stringify({ error: '카카오 API 키(key)가 없습니다.' }), { status: 400, headers: HEADERS });
    if (!x || !y) return new Response(JSON.stringify({ error: 'x(경도)와 y(위도) 파라미터가 필요합니다.' }), { status: 400, headers: HEADERS });

    try {
        const kakaoRes = await fetch(
            `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}&input_coord=WGS84`,
            { headers: { 'Authorization': `KakaoAK ${key.replace(/[^\x00-\x7F]/g, '')}` } }
        );

        if (!kakaoRes.ok) {
            const errText = await kakaoRes.text();
            return new Response(JSON.stringify({ error: '카카오 API 오류', detail: errText }), { status: kakaoRes.status, headers: HEADERS });
        }

        const data = await kakaoRes.json();

        if (!data.documents || data.documents.length === 0) {
            return new Response(JSON.stringify({ address: null, message: '주소를 찾을 수 없습니다.' }), { status: 200, headers: HEADERS });
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

            const _payload1 = {
                road_address:  roadAddress,
                jibun_address: jibunAddress,
                display:       roadAddress.full,
                display_line2: display_line2,
            };
            await saveLatestAddress(_payload1);
            return new Response(JSON.stringify(_payload1), { status: 200, headers: HEADERS });
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

                    const _payload2 = {
                        road_address:  roadAddress,
                        jibun_address: jibunAddress,
                        display:       roadOnly,
                        display_line2: display_line2,
                    };
                    await saveLatestAddress(_payload2);
                    return new Response(JSON.stringify(_payload2), { status: 200, headers: HEADERS });
                }
            }
        } catch (_) {}

        const _payload3 = {
            road_address:  null,
            jibun_address: jibunAddress,
            display:       jibunFull,
            display_line2: null,
        };
        await saveLatestAddress(_payload3);
        return new Response(JSON.stringify(_payload3), { status: 200, headers: HEADERS });

    } catch (e) {
        return new Response(JSON.stringify({ error: '서버 내부 오류', detail: e.message }), { status: 500, headers: HEADERS });
    }
}

export const config = { path: '/api/geocode' };
