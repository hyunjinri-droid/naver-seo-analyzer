// Cloudflare Worker - Naver SEO API Proxy
// 무료: 하루 15회 / Pro: 무제한

const FREE_LIMIT = 15;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null));
    }

    const url = new URL(request.url);

    // ── /keyword - 키워드 분석 ────────────────────────────
    if (url.pathname === "/keyword") {
      const keyword = url.searchParams.get("q");
      if (!keyword) return json({ error: "keyword required" }, 400);

      // Pro 라이선스 검증
      const licenseKey = request.headers.get("X-License-Key");
      const isPro = licenseKey ? await verifyLicense(licenseKey, env) : false;

      if (isPro) {
        const data = await callNaverAPI(keyword, env);
        return json({ ...data, usage: { isPro: true } });
      }

      // 무료: IP 기반 일일 제한
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const today = new Date().toISOString().split("T")[0];
      const kvKey = `usage:${ip}:${today}`;

      let count = 0;
      if (env.USAGE_KV) {
        const val = await env.USAGE_KV.get(kvKey);
        count = val ? parseInt(val) : 0;
      }

      if (count >= FREE_LIMIT) {
        return json({
          error: "daily_limit",
          message: `무료 플랜은 하루 ${FREE_LIMIT}회까지 가능합니다. Pro로 업그레이드하세요!`,
          count,
          limit: FREE_LIMIT
        }, 429);
      }

      const data = await callNaverAPI(keyword, env);

      if (env.USAGE_KV) {
        await env.USAGE_KV.put(kvKey, String(count + 1), { expirationTtl: 86400 });
      }

      return json({
        ...data,
        usage: { isPro: false, count: count + 1, limit: FREE_LIMIT, remaining: FREE_LIMIT - count - 1 }
      });
    }

    // ── /usage - 사용량 확인 ──────────────────────────────
    if (url.pathname === "/usage") {
      const licenseKey = request.headers.get("X-License-Key");
      const isPro = licenseKey ? await verifyLicense(licenseKey, env) : false;

      if (isPro) {
        return json({ isPro: true, count: 0, limit: null, remaining: null });
      }

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const today = new Date().toISOString().split("T")[0];
      const kvKey = `usage:${ip}:${today}`;
      let count = 0;
      if (env.USAGE_KV) {
        const val = await env.USAGE_KV.get(kvKey);
        count = val ? parseInt(val) : 0;
      }
      return json({ isPro: false, count, limit: FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - count) });
    }

    // ── /payment/confirm - 토스페이먼츠 결제 승인 ─────────
    if (url.pathname === "/payment/confirm" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "invalid body" }, 400); }

      const { paymentKey, orderId, amount } = body;
      if (!paymentKey || !orderId || !amount) {
        return json({ error: "missing params" }, 400);
      }

      // 토스 결제 승인 API 호출
      const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(env.TOSS_SECRET_KEY + ":")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentKey, orderId, amount })
      });

      if (!tossRes.ok) {
        const err = await tossRes.json().catch(() => ({}));
        return json({ error: "payment_failed", message: err.message || "결제 승인 실패" }, 400);
      }

      // 라이선스 키 발급 (UUID, 31일 유효)
      const licenseKey = crypto.randomUUID();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 31);

      if (env.USAGE_KV) {
        await env.USAGE_KV.put(
          `license:${licenseKey}`,
          JSON.stringify({ orderId, expiry: expiry.toISOString(), plan: "pro" }),
          { expirationTtl: 32 * 24 * 3600 }
        );
      }

      return json({ licenseKey, expiry: expiry.toISOString() });
    }

    return json({ error: "Not found" }, 404);
  },
};

// ── 라이선스 유효성 검증 ──────────────────────────────────
async function verifyLicense(key, env) {
  if (!env.USAGE_KV || !key) return false;
  const data = await env.USAGE_KV.get(`license:${key}`);
  if (!data) return false;
  try {
    const { expiry } = JSON.parse(data);
    return new Date(expiry) > new Date();
  } catch { return false; }
}

// ── 네이버 검색광고 API 호출 ──────────────────────────────
async function callNaverAPI(keyword, env) {
  const ACCESS_LICENSE = env.NAVER_ACCESS_LICENSE;
  const SECRET_KEY     = env.NAVER_SECRET_KEY;
  const CUSTOMER_ID    = env.NAVER_CUSTOMER_ID;

  const timestamp = Date.now().toString();
  const path = "/keywordstool";
  const message = `${timestamp}.GET.${path}`;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  const params = new URLSearchParams({ hintKeywords: keyword, showDetail: "1" });

  const naverRes = await fetch(
    `https://api.searchad.naver.com/keywordstool?${params}`,
    {
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": ACCESS_LICENSE,
        "X-Customer": CUSTOMER_ID,
        "X-Signature": signature,
      },
    }
  );

  return naverRes.json();
}

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function cors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-License-Key");
  return new Response(res.body, { status: res.status, headers });
}
