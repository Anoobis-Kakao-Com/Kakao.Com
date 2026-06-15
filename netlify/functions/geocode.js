// netlify/functions/geocode.js
// 카카오 API 키는 로컬 HTML에서 전달받습니다 (깃허브에 키 없음)

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // preflight 요청 처리
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // 로컬 HTML에서 key, x(경도), y(위도) 전달받음
  const { key, x, y } = event.queryStringParameters || {};

  if (!key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "카카오 API 키(key)가 없습니다." }),
    };
  }

  if (!x || !y) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "x(경도)와 y(위도) 파라미터가 필요합니다." }),
    };
  }

  try {
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}&input_coord=WGS84`,
      {
        headers: {
          Authorization: `KakaoAK ${key}`,
        },
      }
    );

    if (!kakaoRes.ok) {
      const errText = await kakaoRes.text();
      return {
        statusCode: kakaoRes.status,
        headers,
        body: JSON.stringify({ error: "카카오 API 오류", detail: errText }),
      };
    }

    const data = await kakaoRes.json();

    if (!data.documents || data.documents.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ address: null, message: "주소를 찾을 수 없습니다." }),
      };
    }

    const doc = data.documents[0];

    const roadAddress = doc.road_address
      ? {
          full: doc.road_address.address_name,
          region1: doc.road_address.region_1depth_name,
          region2: doc.road_address.region_2depth_name,
          region3: doc.road_address.region_3depth_name,
          roadName: doc.road_address.road_name,
          buildingNo: doc.road_address.main_building_no +
            (doc.road_address.sub_building_no ? `-${doc.road_address.sub_building_no}` : ""),
          buildingName: doc.road_address.building_name,
          zoneNo: doc.road_address.zone_no,
        }
      : null;

    const jibunAddress = doc.address
      ? {
          full: doc.address.address_name,
          region1: doc.address.region_1depth_name,
          region2: doc.address.region_2depth_name,
          region3: doc.address.region_3depth_name,
          mainAddressNo: doc.address.main_address_no,
          subAddressNo: doc.address.sub_address_no,
        }
      : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        road_address: roadAddress,
        jibun_address: jibunAddress,
        display: roadAddress ? roadAddress.full : jibunAddress?.full,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 내부 오류", detail: err.message }),
    };
  }
};
