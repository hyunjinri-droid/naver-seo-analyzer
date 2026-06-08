// Cloudflare Worker - Naver SEO API Proxy
// 무료: 하루 10회 / Pro: 무제한

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null));
    }

    const url = new URL(request.url);

    if (url.pathname === "/keyword") {
      const keyword = url.searchParams.get("q");
      if (!keyword) return json({ error: "keyword required" }, 400);

      // ── 사용량 제한 (IP 기반, KV 스토리지) ──────────────
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const today = new Date().toISOString().split("T")[0]; // 2026-06-07
      const kvKey = `usage:${ip}:${today}`;

      let count = 0;
      if (env.USAGE_KV) {
        const val = await env.USAGE_KV.get(kvKey);
        count = val ? parseInt(val) : 0;
      }

      const FREE_LIMIT = 10;
      if (count >= FREE_LIMIT) {
        return json({
          error: "daily_limit",
          message: "무료 플랜은 하루 10회까지 가능합니다. Pro로 업그레이드하세요!",
          count,
          limit: FREE_LIMIT
        }, 429);
      }

      // ── 네이버 API 호출 ───────────────────────────────────
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
      const sig = await crypto.subtle.sign(
        "HMAC", key, new TextEncoder().encode(message)
      );
      const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

      const params = new URLSearchParams({
        hintKeywords: keyword,
        showDetail: "1"
      });

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

      const data = await naverRes.json();

      // ── 사용량 증가 ───────────────────────────────────────
      if (env.USAGE_KV) {
        await env.USAGE_KV.put(kvKey, String(count + 1), {
          expirationTtl: 86400 // 24시간 후 자동 삭제
        });
      }

      return json({
        ...data,
        usage: { count: count + 1, limit: FREE_LIMIT, remaining: FREE_LIMIT - count - 1 }
      });
    }

    // 사용량 확인 엔드포인트
    if (url.pathname === "/usage") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const today = new Date().toISOString().split("T")[0];
      const kvKey = `usage:${ip}:${today}`;
      let count = 0;
      if (env.USAGE_KV) {
        const val = await env.USAGE_KV.get(kvKey);
        count = val ? parseInt(val) : 0;
      }
      return json({ count, limit: 10, remaining: Math.max(0, 10 - count) });
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function cors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers });
}
