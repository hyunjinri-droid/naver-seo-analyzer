// popup.js - Naver SEO Analyzer
const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";
const FREE_LIMIT = 15;
const PRO_PAGE_URL = "https://hyunjinri-droid.github.io/naver-seo-analyzer/pro.html";
const LICENSE_KEY = "nseo_license";

async function getLicenseKey() {
  return new Promise(resolve => {
    chrome.storage.local.get([LICENSE_KEY], r => resolve(r[LICENSE_KEY] || null));
  });
}

async function loadUsage() {
  const section = document.getElementById("usage-section");
  const licenseKey = await getLicenseKey();

  try {
    const headers = licenseKey ? { "X-License-Key": licenseKey } : {};
    const res  = await fetch(`${WORKER_URL}/usage`, { headers });
    const data = await res.json();

    if (data.isPro) {
      renderProUsage();
      renderProBanner();
      return;
    }

    const count     = data.count     ?? 0;
    const limit     = data.limit     ?? FREE_LIMIT;
    const remaining = data.remaining ?? Math.max(0, limit - count);
    const pct       = Math.min(100, Math.round((count / limit) * 100));
    const grade = pct >= 90 ? "danger" : pct >= 60 ? "warn" : "";

    section.innerHTML = `
      <div class="usage-card">
        <div class="usage-top">
          <span class="usage-label">오늘 사용량</span>
          <span class="usage-count">${count}<span> / ${limit}회</span></span>
        </div>
        <div class="usage-bar-wrap">
          <div class="usage-bar ${grade}" style="width:${pct}%"></div>
        </div>
        <div class="usage-remain ${grade}">
          ${remaining > 0
            ? `오늘 ${remaining}회 남았어요`
            : `⚠️ 오늘 무료 횟수를 모두 사용했어요`}
        </div>
      </div>
    `;
  } catch (e) {
    section.innerHTML = `
      <div class="usage-card">
        <div class="usage-top">
          <span class="usage-label">오늘 사용량</span>
          <span class="usage-count" style="font-size:13px;color:var(--muted)">확인 불가</span>
        </div>
        <div class="usage-bar-wrap">
          <div class="usage-bar" style="width:0%"></div>
        </div>
        <div class="usage-remain">네이버 블로그 페이지에서 먼저 분석해보세요</div>
      </div>
    `;
  }
}

function renderProUsage() {
  document.getElementById("usage-section").innerHTML = `
    <div class="usage-card">
      <div class="usage-top">
        <span class="usage-label">Pro 플랜</span>
        <span class="usage-count" style="color:var(--accent)">무제한</span>
      </div>
      <div class="usage-bar-wrap">
        <div class="usage-bar" style="width:100%;background:var(--accent);opacity:0.5"></div>
      </div>
      <div class="usage-remain" style="color:var(--accent)">무제한 분석 이용 중이에요 ✨</div>
    </div>
  `;
}

function renderProBanner() {
  const banner = document.querySelector(".pro-banner");
  if (!banner) return;
  banner.innerHTML = `
    <div class="pro-text">
      <strong>Pro 이용 중</strong>
      무제한 분석 · 구독 관리
    </div>
    <button class="pro-btn" id="pro-btn" style="background:#1a1a2e;border:1px solid var(--accent);color:var(--accent)">관리</button>
  `;
  document.getElementById("pro-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: PRO_PAGE_URL });
  });
}

document.getElementById("pro-btn").addEventListener("click", () => {
  const extId = chrome.runtime.id;
  chrome.tabs.create({ url: `${PRO_PAGE_URL}?ext=${extId}` });
});

loadUsage();
