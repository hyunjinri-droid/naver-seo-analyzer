// background.js - Naver SEO Analyzer
// API 호출은 Cloudflare Worker 프록시 경유

const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";

async function getKeywordData(keywords) {
  const keyword = keywords[0];
  const res = await fetch(`${WORKER_URL}/keyword?q=${encodeURIComponent(keyword)}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 오류: ${res.status} - ${err}`);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "ANALYZE_KEYWORD") {
        const data = await getKeywordData(msg.keywords);
        sendResponse({ ok: true, data });
      } else if (msg.type === "SAVE_KEYS") {
        // Worker 방식에서는 키 저장 불필요 (서버에 저장)
        sendResponse({ ok: true });
      } else if (msg.type === "GET_KEYS") {
        sendResponse({ ok: true, configured: true });
      } else {
        sendResponse({ ok: false, error: "Unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});
