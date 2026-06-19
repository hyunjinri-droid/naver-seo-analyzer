// background.js - Naver SEO Analyzer
const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";
const LICENSE_KEY = "nseo_license";

async function getKeywordData(keywords) {
  const keyword = keywords[0];
  const stored = await chrome.storage.local.get([LICENSE_KEY]);
  const licenseKey = stored[LICENSE_KEY] || null;

  const headers = {};
  if (licenseKey) headers["X-License-Key"] = licenseKey;

  const res = await fetch(`${WORKER_URL}/keyword?q=${encodeURIComponent(keyword)}`, { headers });
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
      } else if (msg.type === "GET_LICENSE") {
        const stored = await chrome.storage.local.get([LICENSE_KEY]);
        sendResponse({ ok: true, key: stored[LICENSE_KEY] || null });
      } else if (msg.type === "CLEAR_LICENSE") {
        await chrome.storage.local.remove([LICENSE_KEY]);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});
