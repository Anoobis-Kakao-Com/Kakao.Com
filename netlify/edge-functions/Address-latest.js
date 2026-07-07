import { getStore } from "@netlify/blobs";

// 데스크탑 전용 조회 엔드포인트.
// 카카오 API를 호출하지 않고, 가장 최근에 모바일이 저장해 둔 값만 그대로 반환한다.
const LATEST_KEY = "latest";

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

    const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
        const store = getStore("geo-address");
        const saved = await store.get(LATEST_KEY, { type: 'json' });

        if (!saved) {
            return new Response(JSON.stringify({ data: null }), { status: 200, headers: HEADERS });
        }

        return new Response(JSON.stringify({ data: saved }), { status: 200, headers: HEADERS });
    } catch (e) {
        return new Response(JSON.stringify({ error: '서버 내부 오류', detail: e.message }), { status: 500, headers: HEADERS });
    }
}

export const config = { path: '/api/geocode-latest' };
