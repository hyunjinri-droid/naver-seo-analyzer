// content.js - Naver SEO Analyzer Panel v2.1

(function () {
  if (document.getElementById("nseo-panel")) return;

  const WORKER_URL = "https://naver-seo.hyunjinri.workers.dev";
  const HISTORY_KEY = "nseo_history";
  const MAX_HISTORY = 20;

  // ── 히스토리 유틸 ──────────────────────────────────────
  async function loadHistory() {
    return new Promise(resolve => {
      chrome.storage.local.get([HISTORY_KEY], r => resolve(r[HISTORY_KEY] || []));
    });
  }
  async function saveToHistory(keyword, totalSearch, comp) {
    const history = await loadHistory();
    const existing = history.findIndex(h => h.keyword === keyword);
    if (existing !== -1) history.splice(existing, 1);
    history.unshift({ keyword, totalSearch, comp, date: Date.now() });
    if (history.length > MAX_HISTORY) history.pop();
    chrome.storage.local.set({ [HISTORY_KEY]: history });
  }

  // ── 패널 HTML ──────────────────────────────────────────
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
        <div id="nseo-tabs">
          <button class="nseo-tab active" data-tab="search">🔍 키워드</button>
          <button class="nseo-tab" data-tab="title">✏️ 제목</button>
          <button class="nseo-tab" data-tab="compare">📊 비교</button>
          <button class="nseo-tab" data-tab="history">🕒 기록</button>
        </div>

        <!-- 키워드 탭 -->
        <div id="nseo-tab-search" class="nseo-tab-content active">
          <div id="nseo-input-wrap">
            <input id="nseo-keyword-input" placeholder="키워드 입력 후 Enter" />
            <button id="nseo-analyze-btn">분석</button>
          </div>
          <div id="nseo-results">
            <div class="nseo-empty">키워드를 입력하면<br>검색량과 연관 키워드를 분석해드려요<br><span style="font-size:9px;color:#4a4a60">※ 전월 기준 검색량 데이터</span></div>
          </div>
        </div>

        <!-- 제목 체크 탭 -->
        <div id="nseo-tab-title" class="nseo-tab-content">
          <div class="nseo-title-desc">작성할 제목을 입력하면<br>포함된 키워드의 검색량을 분석해드려요</div>
          <div id="nseo-title-wrap">
            <textarea id="nseo-title-input" placeholder="예: 2026 육아휴직 급여 신청 방법 총정리" rows="2"></textarea>
            <button id="nseo-title-btn">제목 분석</button>
          </div>
          <div id="nseo-title-results"></div>
        </div>

        <!-- 비교 탭 -->
        <div id="nseo-tab-compare" class="nseo-tab-content">
          <div class="nseo-title-desc">키워드를 한 줄에 하나씩 입력하세요 (최대 5개)</div>
          <div id="nseo-compare-wrap">
            <textarea id="nseo-compare-input" placeholder="육아휴직&#10;출산지원금&#10;아동수당" rows="4"></textarea>
            <button id="nseo-compare-btn">비교 분석</button>
          </div>
          <div id="nseo-compare-results"></div>
        </div>

        <!-- 히스토리 탭 -->
        <div id="nseo-tab-history" class="nseo-tab-content">
          <div id="nseo-history-list"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── 탭 전환 ────────────────────────────────────────────
  document.querySelectorAll(".nseo-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nseo-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".nseo-tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("nseo-tab-" + tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "history") renderHistory();
    });
  });

  // ── 드래그 ─────────────────────────────────────────────
  let isDragging = false, dragX = 0, dragY = 0;
  const header = document.getElementById("nseo-header");
  header.addEventListener("mousedown", e => { isDragging = true; dragX = e.clientX - panel.offsetLeft; dragY = e.clientY - panel.offsetTop; });
  document.addEventListener("mousemove", e => { if (!isDragging) return; panel.style.left = (e.clientX - dragX) + "px"; panel.style.top = (e.clientY - dragY) + "px"; panel.style.right = "auto"; });
  document.addEventListener("mouseup", () => { isDragging = false; });
  document.getElementById("nseo-min-btn").addEventListener("click", () => {
    panel.classList.toggle("minimized");
    document.getElementById("nseo-min-btn").textContent = panel.classList.contains("minimized") ? "+" : "−";
  });
  document.getElementById("nseo-close-btn").addEventListener("click", () => panel.remove());

  // ── 사용량 ─────────────────────────────────────────────
  async function loadUsage() {
    try { const res = await fetch(`${WORKER_URL}/usage`); updateBadge(await res.json()); } catch(e) {}
  }
  function updateBadge(usage) {
    const badge = document.getElementById("nseo-usage-badge");
    if (!badge || !usage) return;
    badge.textContent = `${usage.count}/${usage.limit}`;
    badge.style.color = usage.remaining <= 2 ? "#ff5050" : "#6b6b85";
  }
  loadUsage();

  // ── 공통 유틸 ──────────────────────────────────────────
  function safeInt(v) { return parseInt(String(v).replace(/[^0-9]/g, "")) || 0; }
  function formatNum(n) {
    if (!n || n === "") return "0";
    if (String(n).startsWith("<")) return "<10";
    return safeInt(n).toLocaleString("ko-KR");
  }
  function competitionLabel(comp) {
    const map = { "낮음": { label: "낮음", cls: "low" }, "보통": { label: "보통", cls: "mid" }, "높음": { label: "높음", cls: "high" } };
    if (map[comp]) return map[comp];
    const n = parseFloat(comp) || 0;
    if (n < 0.3) return { label: "낮음", cls: "low" };
    if (n < 0.7) return { label: "보통", cls: "mid" };
    return { label: "높음", cls: "high" };
  }

  // ── API 호출 ───────────────────────────────────────────
  async function fetchKeyword(keyword) {
    const res = await fetch(`${WORKER_URL}/keyword?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    if (res.status === 429) throw new Error(data.message || "일일 한도 초과");
    if (!res.ok || data.error) throw new Error(data.error || "분석 실패");
    return data;
  }

  async function fetchTrend(keyword) {
    try {
      const res = await fetch(`${WORKER_URL}/trend?q=${encodeURIComponent(keyword)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch(e) { return null; }
  }

  // ── 트렌드 차트 렌더링 ──────────────────────────────────
  function renderTrendChart(trendData) {
    if (!trendData || !trendData.results || !trendData.results[0]) return "";
    const points = trendData.results[0].data;
    if (!points || points.length === 0) return "";

    const values = points.map(p => p.ratio);
    const max = Math.max(...values) || 1;
    const recent = values.slice(-4); // 최근 4주
    const prev = values.slice(-8, -4); // 이전 4주
    const recentAvg = recent.reduce((a,b) => a+b, 0) / recent.length;
    const prevAvg = prev.reduce((a,b) => a+b, 0) / Math.max(prev.length, 1);
    const trend = recentAvg > prevAvg * 1.1 ? "상승" : recentAvg < prevAvg * 0.9 ? "하락" : "보합";
    const trendCls = trend === "상승" ? "trend-up" : trend === "하락" ? "trend-down" : "trend-flat";
    const trendIcon = trend === "상승" ? "↑" : trend === "하락" ? "↓" : "→";

    // SVG 미니 차트 (최근 12주)
    const chartPoints = values.slice(-12);
    const w = 260, h = 36, pad = 4;
    const stepX = (w - pad*2) / Math.max(chartPoints.length - 1, 1);
    const coords = chartPoints.map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v / max) * (h - pad*2));
      return `${x},${y}`;
    });
    const polyline = coords.join(" ");
    const lastX = pad + (chartPoints.length - 1) * stepX;
    const lastY = h - pad - ((chartPoints[chartPoints.length-1] / max) * (h - pad*2));

    return `
      <div class="nseo-trend-box">
        <div class="nseo-trend-header">
          <span style="font-size:10px;color:#6b6b85">최근 12주 트렌드</span>
          <span class="nseo-trend-badge ${trendCls}">${trendIcon} ${trend}</span>
        </div>
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
          <polyline points="${polyline}" fill="none" stroke="#03c75a" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
          <circle cx="${lastX}" cy="${lastY}" r="3" fill="#03c75a"/>
        </svg>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#4a4a60;margin-top:2px">
          <span>12주 전</span><span>현재</span>
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════
  // 탭 1: 키워드 분석
  // ══════════════════════════════════════════════════════
  function showLoading(targetId, msg) {
    document.getElementById(targetId).innerHTML =
      `<div class="nseo-loading"><div class="nseo-spinner"></div>${msg || "분석 중..."}</div>`;
  }
  function showError(targetId, msg) {
    document.getElementById(targetId).innerHTML = `<div class="nseo-error">${msg}</div>`;
  }

  async function renderResults(keywordList, usage, keyword) {
    const results = document.getElementById("nseo-results");
    if (!keywordList || keywordList.length === 0) {
      results.innerHTML = '<div class="nseo-empty">결과가 없습니다.</div>';
      return;
    }
    const main = keywordList[0];
    const related = keywordList.slice(1, 10);
    const totalSearch = safeInt(main.monthlyPcQcCnt) + safeInt(main.monthlyMobileQcCnt);
    const comp = competitionLabel(main.compIdx);
    if (usage) updateBadge(usage);
    saveToHistory(main.relKeyword, totalSearch, comp.label);

    // 트렌드 병렬 로드
    const trendData = await fetchTrend(keyword || main.relKeyword);
    const trendHtml = renderTrendChart(trendData);

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
        ${trendHtml}
      </div>
    `;

    if (related.length > 0) {
      html += `<div style="margin-top:8px;font-size:10px;color:#6b6b85;margin-bottom:6px;letter-spacing:.5px">연관 키워드 (클릭하면 분석)</div>`;
      related.forEach(k => {
        const total = safeInt(k.monthlyPcQcCnt) + safeInt(k.monthlyMobileQcCnt);
        const kComp = competitionLabel(k.compIdx);
        html += `
          <div class="nseo-keyword-card nseo-related-card" data-keyword="${k.relKeyword}" style="cursor:pointer;opacity:0.85">
            <div class="nseo-kw-top">
              <div class="nseo-kw-name" style="font-size:12px">${k.relKeyword}</div>
              <div class="nseo-competition ${kComp.cls}" style="font-size:9px">경쟁 ${kComp.label}</div>
            </div>
            <div class="nseo-metrics">
              <div class="nseo-metric"><span class="nseo-metric-label">월 검색</span><span class="nseo-metric-value highlight" style="font-size:11px">${formatNum(total)}</span></div>
              <div class="nseo-metric"><span class="nseo-metric-label">PC</span><span class="nseo-metric-value" style="font-size:11px">${formatNum(k.monthlyPcQcCnt)}</span></div>
              <div class="nseo-metric"><span class="nseo-metric-label">모바일</span><span class="nseo-metric-value" style="font-size:11px">${formatNum(k.monthlyMobileQcCnt)}</span></div>
            </div>
          </div>
        `;
      });
    }

    results.innerHTML = html;
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
    showLoading("nseo-results", "분석 중...");
    document.getElementById("nseo-analyze-btn").disabled = true;
    try {
      const data = await fetchKeyword(keyword);
      await renderResults(data.keywordList || [], data.usage, keyword);
    } catch(e) {
      showError("nseo-results", "⚠️ " + e.message);
    } finally {
      document.getElementById("nseo-analyze-btn").disabled = false;
    }
  }

  document.getElementById("nseo-analyze-btn").addEventListener("click", () => {
    analyzeKeyword(document.getElementById("nseo-keyword-input").value.trim());
  });
  document.getElementById("nseo-keyword-input").addEventListener("keydown", e => {
    if (e.key === "Enter") analyzeKeyword(e.target.value.trim());
  });

  // ══════════════════════════════════════════════════════
  // 탭 2: 제목 키워드 체크
  // ══════════════════════════════════════════════════════
  document.getElementById("nseo-title-btn").addEventListener("click", async () => {
    const title = document.getElementById("nseo-title-input").value.trim();
    if (!title) return;
    const resultsEl = document.getElementById("nseo-title-results");
    resultsEl.innerHTML = '<div class="nseo-loading"><div class="nseo-spinner"></div>제목 분석 중...</div>';
    document.getElementById("nseo-title-btn").disabled = true;

    const words = title.split(/[\s,·\/]+/).filter(w => w.length >= 2 && w.length <= 10);
    const targets = words.slice(0, 3);
    if (targets.length === 0) {
      resultsEl.innerHTML = '<div class="nseo-empty">분석할 키워드를 찾지 못했어요</div>';
      document.getElementById("nseo-title-btn").disabled = false;
      return;
    }

    try {
      const results = [];
      for (const word of targets) {
        const data = await fetchKeyword(word);
        if (data.keywordList && data.keywordList.length > 0) {
          const main = data.keywordList[0];
          const total = safeInt(main.monthlyPcQcCnt) + safeInt(main.monthlyMobileQcCnt);
          const comp = competitionLabel(main.compIdx);
          results.push({ keyword: main.relKeyword, total, comp });
          if (data.usage) updateBadge(data.usage);
        }
      }
      if (results.length === 0) { resultsEl.innerHTML = '<div class="nseo-empty">검색량 데이터가 없습니다</div>'; return; }
      results.sort((a, b) => b.total - a.total);
      const maxTotal = results[0].total || 1;
      let html = `<div class="nseo-title-header">제목 키워드 검색량 분석</div>`;
      results.forEach(r => {
        const barWidth = Math.max(8, Math.round((r.total / maxTotal) * 100));
        html += `
          <div class="nseo-compare-row">
            <div class="nseo-compare-kw">${r.keyword}</div>
            <div class="nseo-compare-bar-wrap"><div class="nseo-compare-bar" style="width:${barWidth}%"></div></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
              <span class="nseo-competition ${r.comp.cls}" style="font-size:9px">경쟁 ${r.comp.label}</span>
              <span class="nseo-compare-val">${formatNum(r.total)}</span>
            </div>
          </div>`;
      });
      const highKw = results.filter(r => r.total >= 1000);
      const scoreMsg = highKw.length >= 2 ? `✅ 좋은 제목이에요! 고검색량 키워드가 ${highKw.length}개 포함됐어요.`
        : highKw.length === 1 ? `💡 고검색량 키워드가 1개예요. 연관 키워드를 더 넣어보세요.`
        : `⚠️ 검색량이 낮은 키워드가 많아요. 키워드를 다시 검토해보세요.`;
      html += `<div class="nseo-title-score">${scoreMsg}</div>`;
      resultsEl.innerHTML = html;
    } catch(e) {
      resultsEl.innerHTML = `<div class="nseo-error">⚠️ ${e.message}</div>`;
    } finally {
      document.getElementById("nseo-title-btn").disabled = false;
    }
  });

  // ══════════════════════════════════════════════════════
  // 탭 3: 키워드 비교
  // ══════════════════════════════════════════════════════
  document.getElementById("nseo-compare-btn").addEventListener("click", async () => {
    const raw = document.getElementById("nseo-compare-input").value.trim();
    if (!raw) return;
    const keywords = raw.split("\n").map(k => k.trim()).filter(k => k.length > 0).slice(0, 5);
    if (keywords.length < 2) {
      document.getElementById("nseo-compare-results").innerHTML = '<div class="nseo-empty">키워드를 2개 이상 입력해주세요</div>';
      return;
    }
    const resultsEl = document.getElementById("nseo-compare-results");
    resultsEl.innerHTML = '<div class="nseo-loading"><div class="nseo-spinner"></div>비교 분석 중...</div>';
    document.getElementById("nseo-compare-btn").disabled = true;
    try {
      const results = [];
      for (const kw of keywords) {
        const data = await fetchKeyword(kw);
        if (data.keywordList && data.keywordList.length > 0) {
          const main = data.keywordList[0];
          const total = safeInt(main.monthlyPcQcCnt) + safeInt(main.monthlyMobileQcCnt);
          const comp = competitionLabel(main.compIdx);
          results.push({ keyword: main.relKeyword, total, comp });
          if (data.usage) updateBadge(data.usage);
        }
      }
      results.sort((a, b) => b.total - a.total);
      const maxTotal = results[0]?.total || 1;
      let html = `<div class="nseo-title-header">검색량 비교 결과</div>`;
      results.forEach((r, i) => {
        const barWidth = Math.max(8, Math.round((r.total / maxTotal) * 100));
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
        html += `
          <div class="nseo-compare-row">
            <div class="nseo-compare-kw">${medal} ${r.keyword}</div>
            <div class="nseo-compare-bar-wrap"><div class="nseo-compare-bar" style="width:${barWidth}%"></div></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
              <span class="nseo-competition ${r.comp.cls}" style="font-size:9px">경쟁 ${r.comp.label}</span>
              <span class="nseo-compare-val">${formatNum(r.total)}</span>
            </div>
          </div>`;
      });
      resultsEl.innerHTML = html;
    } catch(e) {
      resultsEl.innerHTML = `<div class="nseo-error">⚠️ ${e.message}</div>`;
    } finally {
      document.getElementById("nseo-compare-btn").disabled = false;
    }
  });

  // ══════════════════════════════════════════════════════
  // 탭 4: 히스토리
  // ══════════════════════════════════════════════════════
  async function renderHistory() {
    const listEl = document.getElementById("nseo-history-list");
    const history = await loadHistory();
    if (history.length === 0) { listEl.innerHTML = '<div class="nseo-empty">아직 분석한 키워드가 없어요</div>'; return; }
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 2px">
        <span style="font-size:10px;color:#6b6b85">최근 분석 키워드</span>
        <button id="nseo-clear-history" style="font-size:9px;color:#6b6b85;background:none;border:1px solid #2a2a3a;border-radius:4px;padding:2px 6px;cursor:pointer">전체삭제</button>
      </div>`;
    history.forEach(h => {
      const date = new Date(h.date);
      const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      const compCls = h.comp === "낮음" ? "low" : h.comp === "보통" ? "mid" : "high";
      html += `
        <div class="nseo-history-item" data-keyword="${h.keyword}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="nseo-history-kw">${h.keyword}</span>
            <span class="nseo-competition ${compCls}" style="font-size:9px">경쟁 ${h.comp}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:3px">
            <span style="font-size:10px;color:#03c75a;font-weight:600">${formatNum(h.totalSearch)}회/월</span>
            <span style="font-size:9px;color:#4a4a60">${dateStr}</span>
          </div>
        </div>`;
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll(".nseo-history-item").forEach(item => {
      item.addEventListener("click", () => {
        const kw = item.dataset.keyword;
        document.getElementById("nseo-keyword-input").value = kw;
        document.querySelectorAll(".nseo-tab")[0].click();
        analyzeKeyword(kw);
      });
    });
    document.getElementById("nseo-clear-history")?.addEventListener("click", () => {
      chrome.storage.local.remove([HISTORY_KEY], () => renderHistory());
    });
  }

})();
