import { getStore } from '@netlify/blobs';

// 데스크탑 전용 조회 엔드포인트.
// 카카오 API를 호출하지 않고, 모바일이 마지막으로 저장해 둔 결과만 그대로 반환한다.
const ADDRESS_STORE_NAME = 'location-cache';
const ADDRESS_STORE_KEY = 'geocode-latest';

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

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
        const store = getStore(ADDRESS_STORE_NAME);
        const saved = await store.get(ADDRESS_STORE_KEY, { type: 'json' });

        if (!saved) {
            return new Response(JSON.stringify({ data: null, savedAt: null }), { status: 200, headers: HEADERS });
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
