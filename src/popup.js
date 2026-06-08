// popup.js - Naver SEO Analyzer
const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";
const FREE_LIMIT = 10;

async function loadUsage() {
  const section = document.getElementById("usage-section");
  try {
    const res  = await fetch(`${WORKER_URL}/usage`);
    const data = await res.json();

    const count     = data.count     ?? 0;
    const limit     = data.limit     ?? FREE_LIMIT;
    const remaining = data.remaining ?? Math.max(0, limit - count);
    const pct       = Math.min(100, Math.round((count / limit) * 100));

    // 색상 등급
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

document.getElementById("pro-btn").addEventListener("click", () => {
  // 추후 결제 페이지 URL로 교체
  chrome.tabs.create({ url: "https://naver-seo.hyunjinri.workers.dev" });
});

loadUsage();
