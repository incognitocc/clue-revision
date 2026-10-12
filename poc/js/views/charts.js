// ds-sense 產出 — 輕量圖表（純 HTML／SVG，不載入外部圖表庫）
// 每個圖表都搭配文字數值或表格替代；顏色只用 app.css 的具名圖表變數（--poc-chart-*）。
import { html, raw } from '../core/dom.js';

const fmt = (n) => Number(n).toLocaleString('zh-TW');

/** 水平長條：rows = [{ label, value, display?, sub?, href?, strong? }] */
export function hBars(rows, { label = '長條圖', max } = {}) {
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return html`<ol class="hbar" aria-label="${label}">
    ${rows.map((r) => {
      const inner = html`<span class="hbar__label">${r.topic ? html`<span class="topic-ref" data-topic="${r.topic}" tabindex="0">${r.label}</span>` : r.label}${r.sub ? html`<span class="hbar__sub">${r.sub}</span>` : ''}</span>
        <span class="hbar__track" aria-hidden="true"><span class="hbar__fill ${r.strong ? 'is-strong' : ''}" style="--w:${(r.value / m) * 100}%"></span></span>
        <span class="hbar__value num">${r.display ?? fmt(r.value)}</span>`;
      return html`<li class="hbar__row">${r.href ? html`<a class="hbar__link" href="${r.href}">${inner}</a>` : html`<div class="hbar__link">${inner}</div>`}</li>`;
    })}
  </ol>`;
}

/** 成對長條（整體 vs 分群） */
export function pairBars(rows, { label }) {
  const m = Math.max(...rows.map((r) => Math.max(r.a, r.b)), 1);
  return html`<div class="pairbar-legend" aria-hidden="true"><span class="legend legend--neutral">整體出現文章數</span><span class="legend legend--data">該分群出現文章數</span></div>
  <ol class="pairbar" aria-label="${label}">
    ${rows.map((r) => html`<li class="pairbar__row">
      <span class="pairbar__label">${r.label}</span>
      <span class="pairbar__bars" aria-hidden="true">
        <span class="pairbar__bar pairbar__bar--a" style="--w:${(r.a / m) * 100}%"></span>
        <span class="pairbar__bar pairbar__bar--b" style="--w:${(r.b / m) * 100}%"></span>
      </span>
      <span class="pairbar__value num"><span class="sr-only">該分群 </span>${fmt(r.b)}<span class="muted"> / ${fmt(r.a)}</span></span>
    </li>`)}
  </ol>`;
}

/** 直條：rows = [{ label, value, strong?, key? }] */
export function columns(rows, { label, onKey = 'cluster' } = {}) {
  const m = Math.max(...rows.map((r) => r.value), 1);
  return html`<div class="colchart" role="group" aria-label="${label}">
    ${rows.map((r) => html`<button type="button" class="colchart__col ${r.strong ? 'is-strong' : ''}" data-${onKey}="${r.key}" aria-pressed="${r.strong ? 'true' : 'false'}" aria-label="${r.label}：${fmt(r.value)} 篇">
      <span class="colchart__value num">${fmt(r.value)}</span>
      <span class="colchart__bar" style="--h:${(r.value / m) * 100}%"></span>
      <span class="colchart__label">${r.label}</span>
    </button>`)}
  </div>`;
}

/** 折線（每日聲量）：series = [{ key, label, values, cls }] */
export function lineChart(dates, series, { label }) {
  const W = 720; const H = 220; const P = { l: 36, r: 12, t: 12, b: 28 };
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const x = (i) => P.l + (i / Math.max(dates.length - 1, 1)) * (W - P.l - P.r);
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const ticks = [0, Math.round(max / 2), max];
  const months = dates.map((d, i) => [d, i]).filter(([d]) => d.endsWith('-01'));
  return html`<figure class="linechart">
    <div class="pairbar-legend" aria-hidden="true">${series.map((s) => html`<span class="legend legend--${s.cls}">${s.label}</span>`)}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="none">
      ${ticks.map((t) => raw(`<line class="linechart__grid" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text class="linechart__tick" x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`))}
      ${months.map(([d, i]) => raw(`<text class="linechart__tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${Number(d.slice(5, 7))}月</text>`))}
      ${series.map((s) => raw(`<polyline class="linechart__line linechart__line--${s.cls}" points="${s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`))}
    </svg>
  </figure>`;
}

/** 熱度表格：values 0–max；rowLabels × colLabels */
export function heatTable(values, rowLabels, colLabels, { caption, max, decimals = 0 } = {}) {
  const m = max ?? Math.max(...values.flat(), 1);
  return html`<table class="heat">
    <caption class="sr-only">${caption}</caption>
    <thead><tr><th scope="col"><span class="sr-only">項目</span></th>${colLabels.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead>
    <tbody>${values.map((row, i) => html`<tr><th scope="row">${rowLabels[i]}</th>${row.map((v) => {
      const p = Math.round((v / m) * 100);
      return html`<td class="num ${p > 55 ? 'is-dark' : ''}" style="--p:${p}%">${v ? v.toFixed(decimals) : (decimals ? '0.00' : '')}</td>`;
    })}</tr>`)}</tbody>
  </table>`;
}

/** 話題分群圖（PCA 投影泡泡圖） */
export function bubbles(clusters, selected) {
  const W = 420; const H = 280; const pad = 48;
  const xs = clusters.map((c) => c.pos[0]); const ys = clusters.map((c) => c.pos[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]; const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (v) => pad + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
  const sy = (v) => H - pad - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  const maxC = Math.max(...clusters.map((c) => c.count));
  const r = (n) => 12 + Math.sqrt(n / maxC) * 26;
  return html`<svg class="bubble" viewBox="0 0 ${W} ${H}" role="img" aria-label="話題分群圖：${clusters.map((c) => `${c.label} ${c.count} 篇`).join('、')}">
    ${raw(`<line class="bubble__axis" x1="${W / 2}" x2="${W / 2}" y1="8" y2="${H - 8}"/><line class="bubble__axis" x1="8" x2="${W - 8}" y1="${H / 2}" y2="${H / 2}"/>`)}
    ${clusters.map((c) => raw(`<g class="bubble__item ${c.id === selected ? 'is-strong' : ''}" data-cluster="${c.id}">
      <circle cx="${sx(c.pos[0]).toFixed(1)}" cy="${sy(c.pos[1]).toFixed(1)}" r="${r(c.count).toFixed(1)}"/>
      <text x="${sx(c.pos[0]).toFixed(1)}" y="${(sy(c.pos[1]) + r(c.count) + 14).toFixed(1)}" text-anchor="middle">${c.id}</text></g>`))}
  </svg>`;
}
