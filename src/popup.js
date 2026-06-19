// popup.js - Naver SEO Analyzer
const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";
const FREE_LIMIT = 15;
// ⚠️ Gumroad 상품 페이지 URL을 아래에 입력하세요
const GUMROAD_URL = "https://adsensepulse.gumroad.com/l/xoppeo";
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
      renderProState();
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

function renderProState() {
  // 사용량 카드 → Pro 표시
  document.getElementById("usage-section").innerHTML = `
    <div class="usage-card">
      <div class="usage-top">
        <span class="usage-label">Pro 플랜</span>
        <span class="usage-count" style="color:var(--accent)">무제한</span>
      </div>
      <div class="usage-bar-wrap">
        <div class="usage-bar" style="width:100%;opacity:0.5"></div>
      </div>
      <div class="usage-remain" style="color:var(--accent)">무제한 분석 이용 중이에요 ✨</div>
    </div>
  `;

  // Pro 배너 → 이용 중 표시
  document.getElementById("pro-banner").innerHTML = `
    <div class="pro-text">
      <strong style="color:var(--accent)">Pro 이용 중 ✓</strong>
      무제한 분석 활성화됨
    </div>
    <button class="pro-btn" id="pro-logout"
      style="background:transparent;border:1px solid var(--border);color:var(--muted)">
      해제
    </button>
  `;
  document.getElementById("toggle-license").style.display = "none";
  document.getElementById("pro-logout").addEventListener("click", async () => {
    await chrome.storage.local.remove([LICENSE_KEY]);
    location.reload();
  });
}

// ── 구매 버튼 ────────────────────────────────────────────
document.getElementById("pro-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: GUMROAD_URL });
});

// ── 라이선스 키 입력 토글 ─────────────────────────────────
document.getElementById("toggle-license").addEventListener("click", () => {
  const section = document.getElementById("license-section");
  const isOpen = section.style.display === "block";
  section.style.display = isOpen ? "none" : "block";
  document.getElementById("toggle-license").textContent =
    isOpen ? "이미 구매하셨나요? 라이선스 키 입력" : "닫기";
  if (!isOpen) document.getElementById("license-input").focus();
});

// ── 라이선스 키 인증 ─────────────────────────────────────
document.getElementById("license-submit").addEventListener("click", verifyKey);
document.getElementById("license-input").addEventListener("keydown", e => {
  if (e.key === "Enter") verifyKey();
});

async function verifyKey() {
  const input = document.getElementById("license-input");
  const btn   = document.getElementById("license-submit");
  const msg   = document.getElementById("license-msg");
  const key   = input.value.trim();

  if (!key) return;

  btn.disabled = true;
  btn.textContent = "확인 중...";
  msg.className = "license-msg";
  msg.textContent = "";

  try {
    const res  = await fetch(`${WORKER_URL}/license/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: key })
    });
    const data = await res.json();

    if (data.valid) {
      await chrome.storage.local.set({ [LICENSE_KEY]: key });
      msg.className = "license-msg ok";
      msg.textContent = "✓ Pro 활성화 완료! 잠시 후 새로고침됩니다.";
      setTimeout(() => location.reload(), 1200);
    } else {
      msg.className = "license-msg err";
      msg.textContent = "유효하지 않은 라이선스 키예요. 다시 확인해주세요.";
    }
  } catch (e) {
    msg.className = "license-msg err";
    msg.textContent = "서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.";
  } finally {
    btn.disabled = false;
    btn.textContent = "인증";
  }
}

loadUsage();
