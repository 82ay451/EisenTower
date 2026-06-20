// Peer returns are injected by the peer extraction workflow.
// The peer universe itself comes from the Theme Mapping master via PD.themes.
const PEER_RETURNS = window.PEER_RETURNS || {};
const PEER_RETURNS_META = window.PEER_RETURNS_META || {};

// ─── Load portfolio data ──────────────────────────────────────────────────────
const PD = window.PORTFOLIO_DATA || null;
const THEME_MAP_PEER_LIMIT = 7;

function getThemes() {
  if (PD) return PD.themes.filter(t => t.actual_value > 0 || t.target_pct > 0);
  return [];
}
function getPositions() {
  return PD ? PD.positions : [];
}
function getThemeById(id) {
  return getThemes().find(t => t.id === id);
}
function shortThemeName(theme) {
  return theme.display_name || theme.name;
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}
function doctrineList(items) {
  return (items || []).map(item => `<li>${esc(item)}</li>`).join('');
}
function peerIndicatorList(theme) {
  const peers = theme.peers || [];
  const withData = peers.filter(ticker => {
    const data = PEER_RETURNS[ticker];
    return data && ['d1', 'w1', 'm1'].some(period => data[period] != null);
  });
  return (withData.length ? withData : peers).slice(0, THEME_MAP_PEER_LIMIT);
}
function formatPct(value) {
  return value == null ? '0.0%' : `${value.toFixed(1)}%`;
}
function stageBucket(stage) {
  const text = String(stage || '');
  if (text.includes('Stable Adoption')) return 'Stable Adoption';
  if (text.includes('Stage 1')) return 'Stage 1';
  if (text.includes('Stage 2')) return 'Stage 2';
  if (text.includes('Stage 3')) return 'Stage 3';
  if (text.includes('Stage 4')) return 'Stage 4';
  return 'Unstaged';
}
const STAGE_FRAME = {
  'Stage 1': {
    name: 'Story / Budget Permission',
    description: 'Market believes the opportunity exists. Revenue remains limited.'
  },
  'Stage 2': {
    name: 'Bottleneck Monetization',
    description: 'Demand is real. Bottlenecks emerge. Value flows to whoever solves the bottleneck.'
  },
  'Stage 3': {
    name: 'Operationalization / Monetization',
    description: 'Technology moves into production. Customers pay for outcomes and measurable ROI.'
  },
  'Stage 4': {
    name: 'Digestion / Pricing Pressure',
    description: 'Supply catches demand. Pricing power weakens and valuation premiums compress.'
  },
  'Unstaged': {
    name: 'Unstaged',
    description: 'No S-Curve state defined in the doctrine.'
  }
};
const STAGE_ORDER = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stable Adoption', 'Unstaged'];
const DOCTRINE_STAGE_COLUMNS = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'];

// ─── Nav ──────────────────────────────────────────────────────────────────────
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ─── Header setup ─────────────────────────────────────────────────────────────
function setupHeader() {
  const badge = document.getElementById('dataSourceBadge');
  const dateEl = document.getElementById('hdrDate');
  if (PD) {
    const m = PD.meta || {};
    const updated = PD.meta.page_updated_bkk || new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' BKK';
    const themeSource = PD.theme_source || PD.doctrine_source || PD.themes?.find(t => t.doctrine_source)?.doctrine_source || 'Theme source missing';
    const portfolioSource = m.portfolio_source_label || (m.source_csv ? 'IBKR CSV fallback' : 'Portfolio source missing');
    badge.innerHTML = `<span class="status-dot dot-live"></span> Portfolio source: ${esc(portfolioSource)} · Theme source: ${esc(themeSource)}`;
    dateEl.textContent = `Data date ${m.date || 'missing'} · Page updated ${updated}`;
  } else {
    badge.innerHTML = `<span class="status-dot dot-stale"></span> No data loaded`;
    dateEl.textContent = 'Data source missing';
  }
}

// ─── Overview: Summary Cards ─────────────────────────────────────────────────
function buildCards() {
  const el = document.getElementById('summaryCards');
  if (!PD) {
    el.innerHTML = `<div class="card"><div class="card-lbl">Status</div><div class="card-val warn">No Data</div><div class="card-sub">WAVE portfolio source not loaded</div></div>`;
    return;
  }
  const m = PD.meta;
  const themes = getThemes().filter(t => t.actual_value > 0);
  const ranked = themes.filter(t => t.actual_value > 0 && t.id !== 'cash');
  const worst = [...ranked].sort((a,b) => a.day_change_usd/a.actual_value - b.day_change_usd/b.actual_value)[0];
  const best  = [...ranked].sort((a,b) => b.day_change_usd/b.actual_value - a.day_change_usd/a.actual_value)[0];
  const f = (v,d=2) => v >= 0 ? `+${v.toFixed(d)}` : v.toFixed(d);
  const c = v => v >= 0 ? 'pos' : 'neg';
  const themePerf = t => t ? t.day_change_usd / t.actual_value * 100 : 0;

  el.innerHTML = [
    `<div class="card"><div class="card-lbl">NAV</div><div class="card-val muted">$${m.nav.toLocaleString('en',{maximumFractionDigits:0})}</div><div class="card-sub">${m.position_count} positions · ${m.classified_count} mapped · ${m.unclassified_count} unmapped</div></div>`,
    `<div class="card"><div class="card-lbl">Stock Value</div><div class="card-val muted">$${m.stock_value.toLocaleString('en',{maximumFractionDigits:0})}</div><div class="card-sub">${m.date}</div></div>`,
    `<div class="card"><div class="card-lbl">Day P&L (Equity)</div><div class="card-val ${c(m.day_change_usd)}">${f(m.day_change_pct,2)}%</div><div class="card-sub">${f(m.day_change_usd,0)} USD</div></div>`,
    `<div class="card"><div class="card-lbl">Best Theme · 1D</div><div class="card-val ${c(themePerf(best))}">${best.emoji} ${f(themePerf(best),1)}%</div><div class="card-sub">${shortThemeName(best)}</div></div>`,
    `<div class="card"><div class="card-lbl">Worst Theme · 1D</div><div class="card-val neg">${worst.emoji} ${f(themePerf(worst),1)}%</div><div class="card-sub">${shortThemeName(worst)}</div></div>`,
  ].join('');
}

// ─── Stage Tab ───────────────────────────────────────────────────────────────
function buildStageTab() {
  const boardEl = document.getElementById('stageBoard');
  const sourceEl = document.getElementById('stageSource');
  if (!boardEl || !sourceEl) return;

  if (!PD) {
    sourceEl.textContent = 'No WAVE data loaded';
    boardEl.innerHTML = `<div class="stage-empty">No data loaded.</div>`;
    return;
  }

  const themes = getThemes()
    .filter(theme => theme.target_pct > 0 || theme.actual_pct > 0)
    .sort((a, b) => {
      const stageCompare = STAGE_ORDER.indexOf(stageBucket(a.s_curve)) - STAGE_ORDER.indexOf(stageBucket(b.s_curve));
      return stageCompare || shortThemeName(a).localeCompare(shortThemeName(b));
    });
  const source = PD.theme_source || PD.doctrine_source || themes.find(theme => theme.doctrine_source)?.doctrine_source || 'Theme source missing';
  sourceEl.textContent = `Theme source: ${source}`;
  const matrixStages = DOCTRINE_STAGE_COLUMNS;
  const gridCols = `220px repeat(${matrixStages.length}, minmax(132px, 1fr)) 118px 62px 62px 62px`;

  const header = `<div class="stage-cell stage-corner">Theme vs Stage</div>${matrixStages.map(bucket => {
    const frame = STAGE_FRAME[bucket] || STAGE_FRAME.Unstaged;
    return `<div class="stage-cell stage-col-head">
      <div class="stage-stage-head-num">${esc(bucket)}</div>
      <div class="stage-stage-head-name">${esc(frame.name)}</div>
    </div>`;
  }).join('')}
    <div class="stage-cell stage-corner">Role</div>
    <div class="stage-cell stage-corner">Target</div>
    <div class="stage-cell stage-corner">Actual</div>
    <div class="stage-cell stage-corner">Drift</div>`;

  const matrixRows = themes.map(theme => {
    const bucket = stageBucket(theme.s_curve);
    const driftCls = theme.drift > 1 ? 'neg' : theme.drift < -1 ? 'pos' : 'muted';
    const axis = `<div class="stage-cell stage-theme-axis" style="color:${theme.color}">
      ${theme.emoji} ${esc(shortThemeName(theme))}
    </div>`;
    const cells = matrixStages.map(stage => {
      if (bucket !== stage) {
        return `<div class="stage-cell stage-hit-empty"></div>`;
      }
      return `<div class="stage-cell stage-hit">
        <div class="stage-hit-value" style="border-color:${theme.color}99;color:${theme.color}">${theme.actual_pct.toFixed(1)}%</div>
      </div>`;
    }).join('');
    const role = bucket === 'Stable Adoption'
      ? 'Ballast'
      : bucket === 'Unstaged'
        ? 'Unstaged'
        : 'Wave';
    return `${axis}${cells}
      <div class="stage-cell stage-role-cell">${role}</div>
      <div class="stage-cell stage-metric-cell">${theme.target_pct}%</div>
      <div class="stage-cell stage-metric-cell">${theme.actual_pct.toFixed(1)}%</div>
      <div class="stage-cell stage-metric-cell ${driftCls}">${theme.drift >= 0 ? '+' : ''}${theme.drift.toFixed(1)}%</div>`;
  }).join('');
  const summaryRows = [
    ['Stage Target', stageThemes => stageThemes.reduce((sum, theme) => sum + theme.target_pct, 0), value => `${value.toFixed(0)}%`, () => ''],
    ['Stage Actual', stageThemes => stageThemes.reduce((sum, theme) => sum + theme.actual_pct, 0), value => `${value.toFixed(1)}%`, () => ''],
    ['Stage Drift', stageThemes => {
      const target = stageThemes.reduce((sum, theme) => sum + theme.target_pct, 0);
      const actual = stageThemes.reduce((sum, theme) => sum + theme.actual_pct, 0);
      return actual - target;
    }, value => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, value => value > 1 ? 'neg' : value < -1 ? 'pos' : 'muted'],
  ].map(([label, calcFn, formatFn, classFn]) => {
    const stageCells = matrixStages.map(bucket => {
      const stageThemes = themes.filter(theme => stageBucket(theme.s_curve) === bucket);
      const value = calcFn(stageThemes);
      return `<div class="stage-cell stage-summary-cell ${classFn(value)}">${formatFn(value)}</div>`;
    }).join('');
    return `<div class="stage-cell stage-summary-axis">${label}</div>${stageCells}
      <div class="stage-cell stage-summary-cell"></div>
      <div class="stage-cell stage-summary-cell"></div>
      <div class="stage-cell stage-summary-cell"></div>
      <div class="stage-cell stage-summary-cell"></div>`;
  }).join('');

  const remarks = matrixStages.map(bucket => {
    const frame = STAGE_FRAME[bucket] || STAGE_FRAME.Unstaged;
    return `<span><strong>${esc(bucket)}:</strong> ${esc(frame.name)} - ${esc(frame.description)}</span>`;
  }).join('');

  boardEl.innerHTML = `<div class="stage-matrix-grid" style="grid-template-columns:${gridCols}">
    ${header}
    ${matrixRows}
    ${summaryRows}
  </div>
  <div class="stage-remarks">
    <div class="stage-remarks-title">Stage remarks</div>
    ${remarks}
  </div>`;
}

// ─── Overview: Theme Allocation ─────────────────────────────────────────────
let themeAllocChart = null;
function buildThemeAllocation() {
  const themes = getThemes().filter(t => t.actual_value > 0 && t.id !== 'unclassified');
  const labels = themes.map(t => `${t.emoji} ${shortThemeName(t)}`);
  const data = themes.map(t => t.actual_pct);
  const colors = themes.map(t => t.color);

  const center = document.getElementById('themeAllocCenter');
  const centerLabel = document.getElementById('themeAllocCenterLbl');
  const canvas = document.getElementById('themeAllocChart');
  const legend = document.getElementById('themeAllocLegend');
  if (!center || !centerLabel || !canvas || !legend) return;

  center.textContent = themes.length;
  centerLabel.textContent = 'themes';

  const ctx = canvas.getContext('2d');
  if (themeAllocChart) themeAllocChart.destroy();
  themeAllocChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(color => color + 'bb'),
        borderColor: colors,
        borderWidth: 1.5,
        hoverOffset: 5
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` } }
      },
      animation: { duration: 700 }
    }
  });

  legend.innerHTML = themes.map(t => {
    const dAbs = Math.abs(t.drift);
    const dCls = dAbs < 1 ? 'drift-ok' : t.drift > 0 ? 'drift-over' : 'drift-under';
    const dTxt = `${t.target_pct}% tgt · ${t.drift >= 0 ? '+' : ''}${t.drift.toFixed(1)}%`;
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${t.color}"></div>
      <div class="legend-name">${esc(shortThemeName(t))}</div>
      <div class="legend-pct" style="color:${t.color}">${t.actual_pct.toFixed(1)}%</div>
      <div class="drift-chip ${dCls}">${dTxt}</div>
    </div>`;
  }).join('');
}

// ─── Overview: Drift Bars ────────────────────────────────────────────────────
function buildDriftRows() {
  const themes = getThemes();
  const maxPct = 55; // scale axis to 55%
  document.getElementById('driftRows').innerHTML = themes.filter(t => t.target_pct > 0 || t.actual_pct > 0).map(t => {
    const actualW  = (t.actual_pct / maxPct * 100).toFixed(1);
    const targetW  = (t.target_pct / maxPct * 100).toFixed(1);
    const dAbs     = Math.abs(t.drift);
    const barColor = dAbs < 1 ? t.color + '99' : t.drift > 0 ? '#ef444488' : '#22c55e88';
    return `<div class="drift-row">
      <div class="drift-row-hdr">
        <div class="drift-row-name">${t.emoji} ${shortThemeName(t)}</div>
        <div class="drift-row-vals">${t.actual_pct.toFixed(1)}% actual · ${t.target_pct}% target · <span class="${t.drift>0?'neg':t.drift<-1?'pos':'muted'}">${t.drift>=0?'+':''}${t.drift.toFixed(1)}% drift</span></div>
      </div>
      <div class="drift-bar-bg">
        <div class="drift-bar-actual" style="width:${actualW}%;background:${barColor};height:5px;border-radius:3px;"></div>
        <div class="drift-target-line" style="left:${targetW}%;background:${t.color};"></div>
      </div>
    </div>`;
  }).join('');
}

// ─── Overview: Day P&L Bar ───────────────────────────────────────────────────
let pnlChart = null;
let overviewPeriod = 'd1';

document.querySelectorAll('#overviewPeriodTabs .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    overviewPeriod = btn.dataset.p;
    document.querySelectorAll('#overviewPeriodTabs .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildDayPnl();
  });
});

function themeWeightedReturn(theme, period) {
  const holdings = getPositions().filter(p => p.theme_id === theme.id);
  let weighted = 0;
  let base = 0;
  holdings.forEach(p => {
    const tv = PEER_RETURNS[p.ticker]?.[period];
    const value = tv ?? (period === 'd1' ? p.day_change_pct : null);
    if (value == null) return;
    weighted += value * p.value;
    base += p.value;
  });
  return base ? +(weighted / base).toFixed(2) : null;
}

function buildDayPnl() {
  const themes = getThemes().filter(t => t.actual_value > 0);
  const pcts   = themes.map(t => themeWeightedReturn(t, overviewPeriod));
  const date   = PEER_RETURNS_META.as_of ? new Date(PEER_RETURNS_META.as_of).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : (PD ? PD.meta.date : 'Static Data');
  const periodLabel = {d1:'1D', w1:'1W', m1:'1M'}[overviewPeriod];
  document.getElementById('dayPnlTitle').textContent = `Theme Performance · ${periodLabel} · Peer returns ${date}`;

  const ctx = document.getElementById('dayPnlChart').getContext('2d');
  if (pnlChart) pnlChart.destroy();
  pnlChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: themes.map(t => t.emoji + ' ' + shortThemeName(t)),
      datasets: [{
        label: periodLabel,
        data:   pcts,
        backgroundColor: pcts.map(v => v == null ? '#64748b55' : v >= 0 ? '#22c55e99' : '#ef444455'),
        borderColor:     pcts.map(v => v == null ? '#64748b' : v >= 0 ? '#22c55e' : '#ef4444'),
        borderWidth: 1.5, borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=> c.parsed.x == null ? ' no peer return data' : ` ${c.parsed.x.toFixed(2)}%`}} },
      scales: {
        x: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#556070', callback:v=>v+'%'} },
        y: { grid:{display:false}, ticks:{color:'#8b96b0', font:{size:11}, autoSkip:false} }
      },
      animation:{duration:500}
    }
  });
}

// ─── Momentum Panel ──────────────────────────────────────────────────────────
let curPeriod = 'd1';

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    curPeriod = btn.dataset.p;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildMomentumGrid();
  });
});

function computeSignal(holdings, peers, period) {
  const vals = [
    ...holdings.map(h => h[period] ?? (period === 'd1' ? h.day_change_pct : null)),
    ...peers.map(p => p[period])
  ].filter(v => v != null);
  if (vals.length < 2) return {cls:'sig-mixed', label:'— No Data'};
  const spread = Math.max(...vals) - Math.min(...vals);
  const allNeg = vals.every(v => v < 0);
  const allPos = vals.every(v => v > 0);
  if (spread < 5 && allNeg) return {cls:'sig-selloff', label:'🔴 Theme Selloff'};
  if (spread < 5 && allPos) return {cls:'sig-rally',   label:'🟢 Theme Rally'};
  if (spread > 8)            return {cls:'sig-diverge', label:'🟡 Diverging'};
  return {cls:'sig-mixed', label:'⚪ Mixed'};
}

function getScale(holdings, peers, period) {
  const vals = [
    ...holdings.map(h => h[period] ?? (period === 'd1' ? h.day_change_pct : null)),
    ...peers.map(p => p[period])
  ].filter(v => v != null);
  if (!vals.length) return {min:-15, max:0};
  return { min: Math.min(...vals, 0) * 1.2, max: Math.max(...vals, 0) * 1.2 || 1 };
}

function barRow(ticker, value, scale, isHolding, meta = {}) {
  const tClass = `bar-ticker ${isHolding ? 'holding' : 'peer'}`;
  const allocation = isHolding && meta.allocation_pct != null ? `<span class="bar-ticker-sub">${meta.allocation_pct.toFixed(2)}% alloc</span>` : '';
  if (value == null) return `<div class="bar-row">
    <div class="${tClass}">${ticker}${allocation}</div>
    <div class="bar-track ${isHolding?'ht':'pt'}"><span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text3);">—</span></div>
    <div class="bar-val muted" style="font-size:10px;">n/a</div>
  </div>`;

  const range = scale.max - scale.min || 1;
  const zp = (-scale.min / range * 100).toFixed(2);
  const vp = ((value - scale.min) / range * 100).toFixed(2);
  const [left, width] = value >= 0 ? [zp, (vp-zp).toFixed(2)] : [vp, (zp-vp).toFixed(2)];
  const color = value >= 0 ? '#22c55e' : '#ef4444';
  const op    = isHolding ? 0.88 : 0.42;
  const vCls  = value >= 0 ? 'pos' : 'neg';
  return `<div class="bar-row">
    <div class="${tClass}">${ticker}${allocation}</div>
    <div class="bar-track ${isHolding?'ht':'pt'}">
      <div class="bar-fill" style="left:${left}%;width:${width}%;background:${color};opacity:${op};top:${isHolding?'2px':'2px'};bottom:${isHolding?'2px':'2px'};"></div>
      <div class="bar-zero" style="left:${zp}%"></div>
    </div>
    <div class="bar-val ${isHolding?'ht':''} ${vCls}">${value>0?'+':''}${value.toFixed(1)}%</div>
  </div>`;
}

function buildMomentumGrid() {
  const grid = document.getElementById('mmtGrid');
  const peerBadge = document.getElementById('peerReturnBadge');
  if (peerBadge) {
    const peerDate = PEER_RETURNS_META.as_of
      ? new Date(PEER_RETURNS_META.as_of).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
      : 'not refreshed';
    peerBadge.textContent = `Peer returns ${peerDate}`;
  }
  grid.innerHTML = '';
  const themes = getThemes();
  const positions = getPositions();

  themes.filter(t => t.actual_value > 0 || t.target_pct > 0).forEach(theme => {
    // Build holdings with momentum values from positions
    const holdings = positions
      .filter(p => p.theme_id === theme.id)
      .map(p => ({
        ticker: p.ticker,
        value: p.value,
        allocation_pct: p.allocation_pct,
        day_change_pct: p.day_change_pct,
        d1: p.day_change_pct,
        w1: null,  // 1W/1M not in CSV; to be added via price history
        m1: null,
      }))
      .sort((a,b) => (a.d1 ?? 999) - (b.d1 ?? 999));

    holdings.forEach(h => {
      const history = PEER_RETURNS[h.ticker] || {};
      h.w1 = history.w1 ?? null;
      h.m1 = history.m1 ?? null;
    });

    const peers = peerIndicatorList(theme).map(ticker => ({
      ticker,
      d1: PEER_RETURNS[ticker]?.d1 ?? null,
      w1: PEER_RETURNS[ticker]?.w1 ?? null,
      m1: PEER_RETURNS[ticker]?.m1 ?? null,
    }));
    const scale = getScale(holdings, peers, curPeriod);

    // Sort by current period
    const sortedH = [...holdings].sort((a,b) => {
      const av = a[curPeriod] ?? 999; const bv = b[curPeriod] ?? 999;
      return av - bv;
    });
    const sortedP = [...peers].sort((a,b) => {
      const av = a[curPeriod] ?? 999; const bv = b[curPeriod] ?? 999;
      return av - bv;
    });

    const signal = computeSignal(holdings, peers, curPeriod);
    const allVals = [...holdings, ...peers].map(t => t[curPeriod] ?? (curPeriod==='d1'?t.day_change_pct:null)).filter(v=>v!=null);
    const spread  = allVals.length >= 2 ? (Math.max(...allVals) - Math.min(...allVals)).toFixed(1) : null;
    const spreadW = spread ? Math.min(parseFloat(spread)/20*100,100).toFixed(0) : 0;

    const hRows = sortedH.map(h => barRow(h.ticker, h[curPeriod] ?? (curPeriod==='d1'?h.day_change_pct:null), scale, true, h)).join('');
    const pRows = sortedP.map(p => barRow(p.ticker, p[curPeriod], scale, false)).join('');

    const card = document.createElement('div');
    card.className = `mmt-card`;
    card.style.borderLeftColor = theme.color;
    card.innerHTML = `
      <div class="mmt-card-hdr">
        <div class="mmt-theme">
          <span>${theme.emoji}</span><span>${shortThemeName(theme)}</span>
          <span class="mmt-theme-sub">${holdings.length} pos</span>
        </div>
        <div class="signal-badge ${signal.cls}">${signal.label}</div>
      </div>
      <div class="spread-row">
        <div class="spread-lbl">Spread (range)</div>
        <div class="spread-bg"><div class="spread-fill" style="width:${spreadW}%"></div></div>
        <div class="spread-val">${spread ? spread + '%' : '—'}</div>
      </div>
      <div class="bar-section">
        <div class="bar-section-lbl" style="color:${theme.color}">▶ Holdings</div>
        <div class="bar-rows">${hRows || '<div style="padding-left:56px;font-size:11px;color:var(--text3);">No positions</div>'}</div>
      </div>
      <div class="bar-peers-sep"></div>
      <div class="bar-section">
        <div class="bar-section-lbl">⬚ Peer Universe</div>
        <div class="bar-rows">${pRows || '<div style="padding-left:56px;font-size:11px;color:var(--text3);">—</div>'}</div>
      </div>`;
    grid.appendChild(card);
  });
}

// ─── Weekly Rebalance ────────────────────────────────────────────────────────
function rebalanceAction(theme) {
  const gap = theme.target_pct - theme.actual_pct;
  if (theme.target_pct === 0 && theme.actual_pct > 0) return { cls: 'act-remove', label: 'Contamination' };
  if (gap > 2) return { cls: 'act-add', label: 'Under target' };
  if (gap < -2) return { cls: 'act-trim', label: 'Over target' };
  return { cls: 'act-hold', label: 'In band' };
}

function money(v) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 0 })}`;
}

function marketValue(v) {
  return `$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 0 })}`;
}

function buildRebalance() {
  const grid = document.getElementById('rebalanceGrid');
  if (!PD) {
    grid.innerHTML = `<div class="rebalance-card"><div class="rebalance-name warn">No WAVE data loaded</div></div>`;
    return;
  }
  const positions = getPositions();
  const themes = getThemes();
  const base = PD.meta.allocation_base || PD.meta.nav || PD.meta.stock_value || 0;

  const cards = themes
    .filter(theme => theme.actual_pct > 0 || theme.target_pct > 0)
    .map(theme => {
      const bucket = positions.filter(p => p.theme_id === theme.id).sort((a, b) => b.value - a.value);
      const action = rebalanceAction(theme);
      const gapPct = theme.target_pct - theme.actual_pct;
      const gapUsd = gapPct / 100 * base;
      const dayPct = theme.actual_value ? theme.day_change_usd / theme.actual_value * 100 : 0;
      const scaleMax = 55;
      const actualW = Math.max(0, Math.min(100, theme.actual_pct / scaleMax * 100));
      const targetW = Math.max(0, Math.min(100, theme.target_pct / scaleMax * 100));
      const keyDrag = [...bucket].sort((a, b) => a.day_change_usd - b.day_change_usd)[0];
      const keyLift = [...bucket].sort((a, b) => b.unrealized_pnl - a.unrealized_pnl)[0];
      const contaminate = theme.target_pct === 0 && theme.actual_pct > 0;
      const note = contaminate
        ? 'This exposure is outside the current WAVE framework. It should not steal focus from Wave validation unless Jay explicitly keeps it in scope.'
        : gapPct > 2
          ? 'Theme is below target. Add only when validation improves; Wave adds on confirmation, not hope.'
          : gapPct < -2
            ? 'Theme is above target. Rebalance review should test whether size is still earned by validation.'
            : 'Theme is near target. Keep watching validation and avoid unnecessary churn.';
      return `<div class="rebalance-card ${contaminate ? 'contaminate' : ''}" style="border-left-color:${theme.color}">
        <div class="rebalance-hdr">
          <div class="rebalance-name" style="color:${theme.color}">${theme.emoji} ${shortThemeName(theme)}</div>
          <div class="rebalance-action ${action.cls}">${action.label}</div>
        </div>
        <div class="rebalance-band">
          <div class="rebalance-fill" style="width:${actualW}%;background:${theme.color}99"></div>
          <div class="rebalance-target" style="left:${targetW}%"></div>
        </div>
        <div class="rebalance-metrics">
          <div class="rebalance-metric"><div class="rebalance-label">Actual / Target</div><div class="rebalance-value">${theme.actual_pct.toFixed(1)}% / ${theme.target_pct}%</div></div>
          <div class="rebalance-metric"><div class="rebalance-label">Gap</div><div class="rebalance-value ${gapPct >= 0 ? 'pos' : 'neg'}">${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%</div></div>
          <div class="rebalance-metric"><div class="rebalance-label">Move To Target</div><div class="rebalance-value ${gapUsd >= 0 ? 'pos' : 'neg'}">${money(gapUsd)}</div></div>
        </div>
        <div class="rebalance-metrics">
          <div class="rebalance-metric"><div class="rebalance-label">1D Theme Stress</div><div class="rebalance-value ${dayPct >= 0 ? 'pos' : 'neg'}">${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(1)}%</div></div>
          <div class="rebalance-metric"><div class="rebalance-label">Main Drag</div><div class="rebalance-value">${keyDrag ? keyDrag.ticker : '-'}</div></div>
          <div class="rebalance-metric"><div class="rebalance-label">Earned Cushion</div><div class="rebalance-value">${keyLift ? keyLift.ticker : '-'}</div></div>
        </div>
        <div class="rebalance-note">${esc(note)}</div>
        <div class="rebalance-holdings">
          ${bucket.map(p => `<span class="holding-chip">${p.ticker} ${(p.allocation_pct || 0).toFixed(2)}% · ${marketValue(p.value || 0)}</span>`).join('') || '<span class="theme-map-text">No current holdings</span>'}
        </div>
      </div>`;
    }).join('');

  grid.innerHTML = cards;
}

// ─── Theme Map ───────────────────────────────────────────────────────────────
function buildThemeMap() {
  const grid = document.getElementById('themeMapGrid');
  const themes = getThemes().filter(theme => theme.id !== 'unclassified');
  const rows = themes.map(theme => {
      const peers = peerIndicatorList(theme);
      const tickers = Object.values(theme.sub_layers || {}).flat();
      const tickerHtml = [...new Set(tickers)].map(ticker => {
        const meta = theme.ticker_meta?.[ticker] || {};
        const classes = [
          'ticker-chip',
          meta.status?.toLowerCase() === 'watchlist' ? 'watch' : ''
        ].filter(Boolean).join(' ');
        const title = [theme.name, meta.status, meta.notes].filter(Boolean).join(' / ');
        return `<span class="${classes}" title="${title}">${ticker}${meta.status?.toLowerCase() === 'watchlist' ? ' · Watchlist' : ''}</span>`;
      }).join('');
      return `<div class="theme-row">
        <div>
          <div class="theme-id" style="color:${theme.color}">${theme.emoji} ${esc(theme.display_name || theme.name)}</div>
          <div class="theme-full">${esc(theme.doctrine_theme || theme.name)}</div>
          <div class="theme-target">${theme.target_pct}% target</div>
          <div class="s-curve-pill">${esc(theme.s_curve || 'Doctrine stage missing')}</div>
        </div>
        <div>
          <div class="theme-map-section">
            <div class="theme-map-label">Theme Logic</div>
            <div class="theme-map-text">${esc(theme.theme_logic || theme.thesis || 'Missing theme logic in source')}</div>
          </div>
          <div class="theme-map-section">
            <div class="theme-map-label">Growth Signal</div>
            <ul class="doctrine-list">${doctrineList(theme.monitoring_signals) || '<li>Missing growth signals in source</li>'}</ul>
          </div>
          <div class="theme-map-section">
            <div class="theme-map-label">Exit Signal</div>
            <ul class="doctrine-list exit">${doctrineList(theme.exit_triggers) || '<li>Missing exit signals in source</li>'}</ul>
          </div>
          <div class="theme-map-section">
            <div class="theme-map-label">Peer Indicators</div>
            <div class="chip-row">${peers.map(ticker => `<span class="ticker-chip">${ticker}</span>`).join('') || '<span class="theme-map-text">No peer indicators in master</span>'}</div>
          </div>
        </div>
        <div>
          <div class="theme-map-label">Tickers</div>
          <div class="chip-row">${tickerHtml || '<span class="theme-map-text">No ticker mapping in master</span>'}</div>
        </div>
      </div>`;
  }).join('');
  grid.innerHTML = rows || '<div class="theme-map-text">No theme map data loaded.</div>';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
setupHeader();

const isLive = !!PD;

buildCards();
buildStageTab();
buildThemeAllocation();
buildDriftRows();
buildDayPnl();
buildMomentumGrid();
buildRebalance();
buildThemeMap();

const initialPage = window.location.hash.replace('#', '');
if (initialPage && document.getElementById('page-' + initialPage)) {
  const initialBtn = document.querySelector(`.nav-btn[onclick="showPage('${initialPage}',this)"]`);
  showPage(initialPage, initialBtn);
}
