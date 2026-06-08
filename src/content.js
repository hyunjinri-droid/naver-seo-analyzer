// content.js - Naver SEO Analyzer Panel

(function () {
  if (document.getElementById("nseo-panel")) return;

  const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";

  const panel = document.createElement("div");
  panel.id = "nseo-panel";
  panel.innerHTML = `
    <div id="nseo-header">
      <div id="nseo-logo">
        <div id="nseo-dot"></div>
        <span>Naver <span style="color:#03c75a">SEO</span></span>
      </div>
      <div id="nseo-controls">
        <span id="nseo-usage-badge" style="font-size:10px;color:#6b6b85;margin-right:4px"></span>
        <button id="nseo-min-btn" title="최소화">−</button>
        <button id="nseo-close-btn" title="닫기">×</button>
      </div>
    </div>
    <div id="nseo-content">
      <div id="nseo-body">
        <div id="nseo-input-wrap">
          <input id="nseo-keyword-input" placeholder="키워드 입력 후 Enter" />
          <button id="nseo-analyze-btn">분석</button>
        </div>
        <div id="nseo-results">
          <div class="nseo-empty">키워드를 입력하면<br>검색량과 연관 키워드를 분석해드려요</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // 드래그
  let isDragging = false, dragX = 0, dragY = 0;
  const header = document.getElementById("nseo-header");
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragX = e.clientX - panel.offsetLeft;
    dragY = e.clientY - panel.offsetTop;
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - dragX) + "px";
    panel.style.top = (e.clientY - dragY) + "px";
    panel.style.right = "auto";
  });
  document.addEventListener("mouseup", () => { isDragging = false; });

  document.getElementById("nseo-min-btn").addEventListener("click", () => {
    panel.classList.toggle("minimized");
    document.getElementById("nseo-min-btn").textContent =
      panel.classList.contains("minimized") ? "+" : "−";
  });
  document.getElementById("nseo-close-btn").addEventListener("click", () => {
    panel.remove();
  });

  // 사용량 표시
  async function loadUsage() {
    try {
      const res = await fetch(`${WORKER_URL}/usage`);
      const data = await res.json();
      const badge = document.getElementById("nseo-usage-badge");
      if (badge) {
        badge.textContent = `${data.count}/${data.limit}`;
        badge.style.color = data.remaining <= 2 ? "#ff5050" : "#6b6b85";
      }
    } catch (e) {}
  }
  loadUsage();

  function showLoading() {
    document.getElementById("nseo-results").innerHTML =
      '<div class="nseo-loading"><div class="nseo-spinner"></div>분석 중...</div>';
  }

  function showError(msg) {
    document.getElementById("nseo-results").innerHTML =
      `<div class="nseo-error">${msg}</div>`;
  }

  function competitionLabel(comp) {
    const map = { "낮음": { label: "낮음", cls: "low" }, "보통": { label: "보통", cls: "mid" }, "높음": { label: "높음", cls: "high" } };
    if (map[comp]) return map[comp];
    const n = parseFloat(comp) || 0;
    if (n < 0.3) return { label: "낮음", cls: "low" };
    if (n < 0.7) return { label: "보통", cls: "mid" };
    return { label: "높음", cls: "high" };
  }

  function formatNum(n) {
    if (!n || n === "<10") return n || "0";
    return parseInt(n).toLocaleString("ko-KR");
  }

  function renderResults(keywordList, usage) {
    const results = document.getElementById("nseo-results");
    if (!keywordList || keywordList.length === 0) {
      results.innerHTML = '<div class="nseo-empty">결과가 없습니다.</div>';
      return;
    }

    const main = keywordList[0];
    const related = keywordList.slice(1, 10);
    const totalSearch = (parseInt(main.monthlyPcQcCnt) || 0) + (parseInt(main.monthlyMobileQcCnt) || 0);
    const comp = competitionLabel(main.compIdx);

    // 사용량 업데이트
    if (usage) {
      const badge = document.getElementById("nseo-usage-badge");
      if (badge) {
        badge.textContent = `${usage.count}/${usage.limit}`;
        badge.style.color = usage.remaining <= 2 ? "#ff5050" : "#6b6b85";
      }
    }

    let html = `
      <div class="nseo-keyword-card">
        <div class="nseo-kw-top">
          <div class="nseo-kw-name">${main.relKeyword}</div>
          <div class="nseo-competition ${comp.cls}">경쟁 ${comp.label}</div>
        </div>
        <div class="nseo-metrics">
          <div class="nseo-metric">
            <span class="nseo-metric-label">월 검색</span>
            <span class="nseo-metric-value highlight">${formatNum(totalSearch)}</span>
          </div>
          <div class="nseo-metric">
            <span class="nseo-metric-label">PC</span>
            <span class="nseo-metric-value">${formatNum(main.monthlyPcQcCnt)}</span>
          </div>
          <div class="nseo-metric">
            <span class="nseo-metric-label">모바일</span>
            <span class="nseo-metric-value">${formatNum(main.monthlyMobileQcCnt)}</span>
          </div>
        </div>
      </div>
    `;

    // 연관 키워드 섹션
    if (related.length > 0) {
      html += `<div style="margin-top:8px;font-size:10px;color:#6b6b85;margin-bottom:6px;letter-spacing:.5px">연관 키워드 (클릭하면 분석)</div>`;
      related.forEach(k => {
        const total = (parseInt(k.monthlyPcQcCnt) || 0) + (parseInt(k.monthlyMobileQcCnt) || 0);
        const kComp = competitionLabel(k.compIdx);
        html += `
          <div class="nseo-keyword-card nseo-related-card" data-keyword="${k.relKeyword}" style="cursor:pointer;opacity:0.85">
            <div class="nseo-kw-top">
              <div class="nseo-kw-name" style="font-size:12px">${k.relKeyword}</div>
              <div class="nseo-competition ${kComp.cls}" style="font-size:9px">경쟁 ${kComp.label}</div>
            </div>
            <div class="nseo-metrics">
              <div class="nseo-metric">
                <span class="nseo-metric-label">월 검색</span>
                <span class="nseo-metric-value highlight" style="font-size:11px">${formatNum(total)}</span>
              </div>
              <div class="nseo-metric">
                <span class="nseo-metric-label">PC</span>
                <span class="nseo-metric-value" style="font-size:11px">${formatNum(k.monthlyPcQcCnt)}</span>
              </div>
              <div class="nseo-metric">
                <span class="nseo-metric-label">모바일</span>
                <span class="nseo-metric-value" style="font-size:11px">${formatNum(k.monthlyMobileQcCnt)}</span>
              </div>
            </div>
          </div>
        `;
      });
    }

    results.innerHTML = html;

    // 연관 키워드 클릭 재분석
    results.querySelectorAll(".nseo-related-card").forEach(card => {
      card.addEventListener("click", () => {
        const kw = card.dataset.keyword;
        document.getElementById("nseo-keyword-input").value = kw;
        analyzeKeyword(kw);
      });
      card.addEventListener("mouseenter", () => card.style.opacity = "1");
      card.addEventListener("mouseleave", () => card.style.opacity = "0.85");
    });
  }

  async function analyzeKeyword(keyword) {
    if (!keyword.trim()) return;
    showLoading();
    document.getElementById("nseo-analyze-btn").disabled = true;

    try {
      const res = await fetch(`${WORKER_URL}/keyword?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();

      if (res.status === 429) {
        showError(`⚠️ ${data.message}`);
        return;
      }
      if (!res.ok || data.error) {
        showError(data.error || "분석 실패");
        return;
      }

      renderResults(data.keywordList || [], data.usage);
      // 사용량 badge 즉시 업데이트
      if (data.usage) {
        const badge = document.getElementById("nseo-usage-badge");
        if (badge) {
          badge.textContent = `${data.usage.count}/${data.usage.limit}`;
          badge.style.color = data.usage.remaining <= 2 ? "#ff5050" : "#6b6b85";
        }
      }
    } catch (e) {
      showError("네트워크 오류: " + e.message);
    } finally {
      document.getElementById("nseo-analyze-btn").disabled = false;
    }
  }

  document.getElementById("nseo-analyze-btn").addEventListener("click", () => {
    analyzeKeyword(document.getElementById("nseo-keyword-input").value.trim());
  });

  document.getElementById("nseo-keyword-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyzeKeyword(e.target.value.trim());
  });

})();
