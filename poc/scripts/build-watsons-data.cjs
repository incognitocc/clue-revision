// ds-sense 產出 — 把屈臣氏測試資料轉成 POC 用的靜態資料檔（離線執行一次即可）
//
// 輸入（使用者提供的 POC 範本資料）：
//   Raw_data/Social Listening Data _testing (Waston).xlsx   ← 上傳的社群文章
//   Raw_data/Keyword Data _testing (Waston).xlsx            ← 上傳的自訂關鍵字（新增／刪除）
//   test data/2551/zip_Topic_{1..6}_6.csv                    ← 既有分群模型輸出（每篇主文的 Topic）
// 輸出：
//   js/data/watsons.js            ← 統計、關鍵字、矩陣、報告數據（全由上方資料實算）
//   js/data/watsons-articles.js   ← 1,957 篇主文（含分群標記），供來源查核
//
// 用法：NODE_PATH=<含 xlsx 的 node_modules> node scripts/build-watsons-data.cjs [Clue 資料根目錄]
// 摘要文字（各分群摘要）取自使用者提供的「各分群主題摘要內容」截圖，僅移除 Markdown 星號與模型的開場語。

const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const ROOT = process.argv[2] || '/Users/rchen15/Works/Clue';
const OUT = path.join(__dirname, '..', 'js', 'data');

// ───────── CSV（UTF-8 BOM、引號內換行） ─────────
function parseCSV(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k || 'idx', r[i] ?? ''])));
}

const num = (v) => Number(String(v).replace(/,/g, '')) || 0;
const keyOf = (r) => `${String(r['發布時間']).trim()}|${String(r['原始連結']).trim()}|${String(r['內容']).slice(0, 60)}`;

// ───────── 讀資料 ─────────
const wb = X.readFile(path.join(ROOT, 'Raw_data', 'Social Listening Data _testing (Waston).xlsx'));
const allRows = X.utils.sheet_to_json(wb.Sheets['報表'], { defval: '', raw: false });
const info = Object.fromEntries(X.utils.sheet_to_json(wb.Sheets['下載資訊'], { header: 1, defval: '' }).slice(1).filter((r) => r[0]).map((r) => [r[0], r[1]]));
const posts = allRows.filter((r) => r['主文/回文'] === '主文');

const kwRows = X.utils.sheet_to_json(X.readFile(path.join(ROOT, 'Raw_data', 'Keyword Data _testing (Waston).xlsx')).Sheets['工作表1'], { header: 1, defval: '' }).slice(1);
const kwAdd = kwRows.map((r) => String(r[0]).trim()).filter(Boolean);
const kwDel = kwRows.map((r) => String(r[1]).trim()).filter(Boolean);

const clusterOf = new Map();
for (let t = 1; t <= 6; t++) {
  for (const r of parseCSV(path.join(ROOT, 'test data', '2551', `zip_Topic_${t}_6.csv`))) clusterOf.set(keyOf(r), Number(r.Topic));
}

// ───────── 文章 ─────────
const articles = posts.map((r, i) => {
  const likes = num(r['按讚/觀看']); const shares = num(r['分享/轉貼數/評級']); const comments = num(r['顯示留言數(該主文顯示的留言數量)']);
  const d = new Date(String(r['發布時間']).replace(/\//g, '-').replace(' ', 'T') + '+08:00');
  return {
    id: `W-${String(i + 1).padStart(4, '0')}`,
    cluster: clusterOf.get(keyOf(r)) ?? null,
    title: String(r['標題']).trim(),
    body: String(r['內容']).trim(),
    source: r['來源'],
    site: r['網站'],
    publishedAt: String(r['發布時間']).trim(),
    author: r['作者'],
    sentiment: r['情緒標記'],
    likes, shares, comments, engagement: likes + shares + comments,
    replies: num(r['討論串總則數(OpView收錄回文文章數)']),
    url: String(r['原始連結']).trim(),
    _d: d,
  };
});
const matched = articles.filter((a) => a.cluster).length;
if (matched !== clusterOf.size) console.warn(`⚠ 分群對應 ${matched}/${clusterOf.size}`);

// ───────── 分群統計 ─────────
const SUMMARIES = {
  1: { summary: '這批文件整體圍繞在屈臣氏等藥妝通路中的美妝與個人護理消費討論，核心內容以臉部保養、身體保養、頭髮護理為主，涵蓋保濕、美白、修護、抗老、控油、抗痘、舒敏等常見功效訴求。內容形式多為論壇式的產品推薦、使用心得、空瓶分享、膚質／髮質對應請益，以及換季或特殊膚況的保養困擾。此外，也常延伸到敏感肌、痘痘肌、醫美術後照護等問題肌情境，以及少量的生活日用品與保健品討論。整體而言，這是一組以藥妝通路購物情境為核心，結合產品選購、使用經驗與個人護理需求的綜合性內容集合。' },
  2: { summary: '這批文件整體聚焦於「屈臣氏（Watsons）」作為藥妝與生活消費場域的相關討論，內容涵蓋商品購買與使用經驗、促銷優惠與點數活動、門市資訊，以及以屈臣氏為地點參照的在地生活交流。其中特別突出的核心內容包括美妝保養商品、隱形眼鏡／彩隱，以及各類折扣、集點與換購活動；此外，也常延伸到與寶雅、康是美、藥局等通路的價格與商品比較。整體而言，這是一組以屈臣氏為中心，結合購物決策、消費情報與地方社群訊息的內容集合。' },
  3: { summary: '這批文件主要聚焦於屈臣氏通路相關內容，核心涵蓋開架美妝與保養商品分享、購物經驗、折扣優惠與集點活動資訊，並延伸至部分個人護理與保健商品，是一組以「屈臣氏消費場景」為中心的商品與促銷情報整理。' },
  4: { summary: '以屈臣氏等開架通路為核心的美妝、保養與日用品消費討論，涵蓋商品評價、購物經驗、使用心得、推薦請益，以及延伸的二手交易與生活消費資訊。', oneLiner: '圍繞屈臣氏通路的開架美妝保養、商品購買分享與生活消費交流。' },
  5: { summary: '這批內容主要圍繞「屈臣氏」相關的社群討論與消費資訊，涵蓋門市購物經驗、優惠促銷與點數活動、商品使用心得、美妝保健與生活用品推薦，以及門市服務、遺失物、面交等日常互動；同時也包含品牌行銷新聞、公益活動，以及徵才、面試、薪資與員工工作經驗等職場話題。', oneLiner: '以屈臣氏為核心的社群內容，整合了消費優惠、商品評價、門市互動、品牌活動與工作職場等多面向討論。' },
  6: { summary: '這批文件整體圍繞著屈臣氏相關的消費與交易行為，核心主軸是集點贈品、換購商品與聯名周邊的交換／徵求／販售，尤其集中在迪士尼系列贈品（如反派、公主、杯套、提袋、餐具、收納用品等）。延伸內容則包含屈臣氏通路的優惠資訊、點數活動、商品購買討論，以及與通路高度相關的美妝保養、個人清潔、口腔與私密護理等消費經驗分享。此外，也有相當比例的內容涉及口罩與其他聯名商品的交易交換，並夾雜部分商業宣傳貼文與少量生活雜談、地方資訊。綜合來看，這是一組以屈臣氏為中心，結合贈品交換、優惠購物、聯名商品交易與日常美妝保養討論的消費型文本集合。' },
};

// ───────── 關鍵字（POC：以詞庫做子字串比對，計「出現文章數」） ─────────
// 詞庫 = 參考截圖中出現的關鍵字 ∪ 自訂「新增關鍵字」，再扣除「刪除關鍵字」。正式分詞方法待確認。
const BASE_VOCAB = '一下 乳液 交換 今天 付款 保濕 保養 口罩 唇膏 夜幕 店員 想換 最新 有人 沐浴乳 沒有 牛仔 特價 生活 皮膚 直接 眼影 眼線 肌膚 謝謝 豹吻 集點 霓紫 面膜 顏色 乾燥 保養品 修護 品牌 問題 大家 天氣 容易 尿酸 感覺 成分 推薦 效果 敏感 最近 有效 產品 痘痘 精華 系列 美白 舒緩 覺得 不錯 便宜 商品 好用 寶雅 很多 換購 文章 時候 拒絕 廁所 逛街 時間 火熱 開始 台灣 好吃 今日 兒子 人性 肚子痛 借廁 當場 公司 面交 美食 只能 記得 影片 問卷 網路 康是美 點數 優惠 折扣 門市 贈品 迪士尼 隱形眼鏡 彩妝 防曬 洗髮精 薪水 面試 員工 會員 折價券 新品 開架 卸妝 化妝水'.split(' ');
const delSet = new Set(kwDel.map((k) => k.toLowerCase()));
const vocab = [...new Set([...BASE_VOCAB, ...kwAdd])].filter((k) => !delSet.has(k.toLowerCase()));

const clustered = articles.filter((a) => a.cluster);
const text = (a) => `${a.title} ${a.body}`.toLowerCase();
const has = new Map(); // kw -> Set(article index in clustered)
vocab.forEach((k) => {
  const lk = k.toLowerCase(); const s = new Set();
  clustered.forEach((a, i) => { if (text(a).includes(lk)) s.add(i); });
  has.set(k, s);
});
const overall = vocab.map((k) => ({ k, c: has.get(k).size })).filter((x) => x.c > 0);
const overallMap = Object.fromEntries(overall.map((x) => [x.k, x.c]));

const clusters = [];
for (let t = 1; t <= 6; t++) {
  const idx = new Set(clustered.map((a, i) => (a.cluster === t ? i : -1)).filter((i) => i >= 0));
  const mine = clustered.filter((a) => a.cluster === t);
  const kws = vocab.map((k) => ({ k, c: [...has.get(k)].filter((i) => idx.has(i)).length, overall: overallMap[k] || 0 }))
    .filter((x) => x.c > 0).sort((a, b) => b.c - a.c || a.k.localeCompare(b.k, 'zh-Hant'));
  // 關鍵字矩陣：前 20 個關鍵字在本分群文章中的共現（cosine，0–1）
  const top = kws.slice(0, 20).map((x) => x.k);
  const vec = top.map((k) => new Set([...has.get(k)].filter((i) => idx.has(i))));
  const matrix = vec.map((a) => vec.map((b) => {
    const inter = [...a].filter((i) => b.has(i)).length;
    return a.size && b.size ? Math.round((inter / Math.sqrt(a.size * b.size)) * 100) / 100 : 0;
  }));
  const sent = { 正面: 0, 中立: 0, 負面: 0 };
  mine.forEach((a) => { sent[a.sentiment] = (sent[a.sentiment] || 0) + 1; });
  clusters.push({
    id: t,
    label: `分群 ${t}`,
    count: mine.length,
    ...SUMMARIES[t],
    sentiment: sent,
    avgEngagement: Math.round(mine.reduce((s, a) => s + a.engagement, 0) / mine.length),
    keywords: kws.slice(0, 30),
    matrix: { keys: top, values: matrix },
    vector: vocab.map((k) => [...has.get(k)].filter((i) => idx.has(i)).length / mine.length),
  });
}

// 話題分群圖：分群關鍵字輪廓做 PCA（2 維）投影 → 相對位置
(function pca() {
  const M = clusters.map((c) => c.vector);
  const d = M[0].length; const mean = Array(d).fill(0);
  M.forEach((r) => r.forEach((v, j) => { mean[j] += v / M.length; }));
  const C = M.map((r) => r.map((v, j) => v - mean[j]));
  const comps = [];
  for (let p = 0; p < 2; p++) {
    let v = Array.from({ length: d }, (_, j) => Math.sin(j + 1 + p));
    for (let it = 0; it < 200; it++) {
      const proj = C.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));
      let nv = Array(d).fill(0);
      C.forEach((r, i) => r.forEach((x, j) => { nv[j] += x * proj[i]; }));
      comps.forEach((u) => { const dot = nv.reduce((s, x, j) => s + x * u[j], 0); nv = nv.map((x, j) => x - dot * u[j]); });
      const n = Math.hypot(...nv) || 1; v = nv.map((x) => x / n);
    }
    comps.push(v);
  }
  clusters.forEach((c, i) => {
    c.pos = comps.map((u) => Math.round(C[i].reduce((s, x, j) => s + x * u[j], 0) * 1000) / 1000);
    delete c.vector;
  });
})();

// ───────── 話題洞察報告（版面參考 ai-result.html；數字全部由上傳資料實算） ─────────
const totalPosts = articles.length;
const totalEng = articles.reduce((s, a) => s + a.engagement, 0);
const pos = articles.filter((a) => a.sentiment === '正面').length;
const neg = articles.filter((a) => a.sentiment === '負面').length;
const platforms = [...new Set(articles.map((a) => a.source))].map((p) => {
  const g = articles.filter((a) => a.source === p);
  return { label: p, count: g.length, avgLike: Math.round(g.reduce((s, a) => s + a.likes, 0) / g.length), avgComment: +(g.reduce((s, a) => s + a.comments, 0) / g.length).toFixed(1), posRate: +(g.filter((a) => a.sentiment === '正面').length / g.length * 100).toFixed(1) };
}).sort((a, b) => b.count - a.count);
const tw = (a) => new Date(a._d.getTime() + 8 * 3600e3); // 以台北時間取日期／時段
const dayKey = (a) => tw(a).toISOString().slice(0, 10);
const days = [...new Set(articles.map(dayKey))].sort();
const daily = days.map((d) => { const g = articles.filter((a) => dayKey(a) === d); return { date: d, total: g.length, pos: g.filter((a) => a.sentiment === '正面').length, neg: g.filter((a) => a.sentiment === '負面').length }; });
const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
articles.forEach((a) => { const t = tw(a); heat[(t.getUTCDay() + 6) % 7][t.getUTCHours()]++; });
const hourly = Array.from({ length: 24 }, (_, h) => heat.reduce((s, r) => s + r[h], 0));
const weekday = heat.map((r) => r.reduce((s, x) => s + x, 0));
const peaks = [...daily].sort((a, b) => b.total - a.total || a.date.localeCompare(b.date)).slice(0, 5).sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
  const g = articles.filter((a) => dayKey(a) === d.date);
  const byC = {}; g.forEach((a) => { const k = a.cluster ? `分群 ${a.cluster}` : '未分群'; byC[k] = (byC[k] || 0) + 1; });
  const topPost = [...g].sort((a, b) => b.engagement - a.engagement)[0];
  return { ...d, clusters: Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 3), topPost: { id: topPost.id, title: topPost.title || topPost.body.slice(0, 40), engagement: topPost.engagement } };
});
const clusterRows = clusters.map((c) => ({ id: c.id, label: c.label, count: c.count, avgEngagement: c.avgEngagement, posRate: +(c.sentiment['正面'] / c.count * 100).toFixed(1), negRate: +(c.sentiment['負面'] / c.count * 100).toFixed(1) }));

const meta = {
  datasetName: 'Social Listening Data _testing (Waston).xlsx',
  keywordFileName: 'Keyword Data _testing (Waston).xlsx',
  topic: info['查詢主題'],
  period: info['查詢期間'],
  sources: info['來源'],
  totalRows: allRows.length,
  totalPosts,
  totalReplies: allRows.length - totalPosts,
  clusteredPosts: clustered.length,
  unclusteredPosts: totalPosts - clustered.length,
  keywordAdd: kwAdd,
  keywordDel: kwDel,
  vocabSize: vocab.length,
  generatedAt: new Date().toISOString().slice(0, 10),
};
const report = {
  kpis: { totalPosts, avgEngagement: Math.round(totalEng / totalPosts), posRate: +(pos / totalPosts * 100).toFixed(1), negRate: +(neg / totalPosts * 100).toFixed(1), clusterCoverage: +(clustered.length / totalPosts * 100).toFixed(1), clusterCount: clusters.length },
  clusterRows, platforms, daily, heatmap: heat, hourly, weekday, peaks,
};

const banner = '// ds-sense 產出 — 由 scripts/build-watsons-data.cjs 產生，請勿手改\n';
fs.writeFileSync(path.join(OUT, 'watsons.js'), `${banner}export const WATSONS = ${JSON.stringify({ meta, clusters, overallKeywords: overall.sort((a, b) => b.c - a.c).slice(0, 30), report })};\n`);
fs.writeFileSync(path.join(OUT, 'watsons-articles.js'), `${banner}export const WATSONS_ARTICLES = ${JSON.stringify(articles.map(({ _d, ...a }) => a))};\n`);
console.log({ posts: totalPosts, clustered: clustered.length, vocab: vocab.length, kpis: report.kpis, clusterCounts: clusters.map((c) => c.count), peaks: peaks.map((p) => p.date + ':' + p.total) });
