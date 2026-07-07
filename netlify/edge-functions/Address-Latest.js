import { getStore } from '@netlify/blobs';

const LATEST_KEY = 'address-latest';

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

// 데스크탑 전용 조회 엔드포인트: 외부(카카오) API를 호출하지 않고,
// 모바일이 이전에 저장해 둔 마지막 주소 값만 반환한다.
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

    try {
        const store = getStore({ name: 'location-cache' });
        const saved = await store.get(LATEST_KEY, { type: 'json' });

        if (!saved) {
            return new Response(JSON.stringify({ data: null }), { status: 200, headers: HEADERS });
        }

        return new Response(JSON.stringify({
            data: saved.data,
            savedAt: saved.savedAt,
        }), { status: 200, headers: HEADERS });

    } catch (e) {
        return new Response(JSON.stringify({ error: '서버 내부 오류', detail: e.message }), { status: 500, headers: HEADERS });
    }
}

export const config = { path: '/api/geocode-latest' };
