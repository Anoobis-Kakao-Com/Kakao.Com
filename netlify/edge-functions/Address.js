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

    if (!key || !x || !y) {
        return new Response(JSON.stringify({ error: 'key, x, y 파라미터 필요' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const target = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}&input_coord=WGS84`;

    try {
        const res = await fetch(target, { headers: { 'Authorization': `KakaoAK ${key}`, 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('http ' + res.status);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: '카카오 API 호출 실패' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

export const config = { path: '/api/geocode' };
