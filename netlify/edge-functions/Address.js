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

        const roadAddress = doc.road_address ? {
            full:         doc.road_address.address_name,
            region1:      doc.road_address.region_1depth_name,
            region2:      doc.road_address.region_2depth_name,
            region3:      doc.road_address.region_3depth_name,
            roadName:     doc.road_address.road_name,
            buildingNo:   doc.road_address.main_building_no + (doc.road_address.sub_building_no ? `-${doc.road_address.sub_building_no}` : ''),
            buildingName: doc.road_address.building_name,
            zoneNo:       doc.road_address.zone_no,
        } : null;

        const jibunAddress = doc.address ? {
            full:          doc.address.address_name,
            region1:       doc.address.region_1depth_name,
            region2:       doc.address.region_2depth_name,
            region3:       doc.address.region_3depth_name,
            mainAddressNo: doc.address.main_address_no,
            subAddressNo:  doc.address.sub_address_no,
        } : null;

        return new Response(JSON.stringify({
            road_address:  roadAddress,
            jibun_address: jibunAddress,
            display:       roadAddress ? roadAddress.full : jibunAddress?.full,
        }), { status: 200, headers: HEADERS });

    } catch (e) {
        return new Response(JSON.stringify({ error: '서버 내부 오류', detail: e.message }), { status: 500, headers: HEADERS });
    }
}

export const config = { path: '/api/geocode' };
