---
name: ds-sense
description: >-
  做 UI 時注入 @dsc-ai-project Design System 的手感——元件、頁面、demo、原型、
  改 PM 的 vibe code，任何框架或純 HTML 都適用。讀 DS 的 token、元件契約與可攜
  CSS 當材料，配 Raphael 的 UX 策略當方向，然後自由發揮。沒裝 DS 會依環境自動裝好。
  只要使用者在做畫面、調樣式、拉版面、做原型就該用，即使他沒提到 design system
  或 DSC。純參考、不設限：不跑審查、不擋規範。
---

# ds-sense

DS 的 token 與元件是**材料**，Raphael 的 UX 策略是**方向**——不是合規清單。做得比 DS 更多是預期中的事。

底線只有一條：**別讓產出繞過 theme 機制**。整套 DS 的價值在於換 `data-theme` 就換一套品牌，寫死顏色會無聲破壞它，而且沒有任何工具擋得住。

## 規則

這五條適用於每一步。其餘都可自由發揮。

1. **語意角色一律用 `var(--ds-*)`** — 按鈕、表面、邊框、文字、focus、間距、圓角、字級。查到的 hex 是拿來理解的，不是拿來寫進去的。
2. **一次性字面色可以自己定** — 圖表第 N 條系列、第三方品牌色、原型探索色，這些不在 DS 職責內。但收成具名的區域 CSS 變數，別散在 inline style，也別讓它看起來像語意角色。
3. **prop 值照 manifest 填，不要猜** — `values` / `shape` 已經把可用值展開了。猜錯在非 Angular 環境不會有任何東西擋你。
4. **不憑空手刻** — 非 Angular 環境有現成的可攜 CSS 與真實 DOM 可抄，見 Step 3。
5. **缺口要講出來** — DS 沒有的東西照做無妨，但在回覆裡說一句「這個 DS 沒有，我自己做的」。使用者需要知道哪些部分沒有 DS 背書。

## Step 0 — 就位

讀 target 目錄的 `package.json`，確認 `@dsc-ai-project/ng-ui` 與 `@dsc-ai-project/tokens` 在不在 `node_modules`。已裝就跳 Step 1。

未裝依環境安裝：

| 環境 | 裝什麼 | 產物形式 |
|---|---|---|
| Angular app（deps 有 `@angular/core`） | `ng-ui` ＋ `tokens` | 真 `ds-*` 元件 |
| 其他框架（React / Vue / Svelte…） | 同上，但 `ng-ui` **只當素材來源**——Angular 元件掛不進去 | 該框架的元件 ＋ DS 的 CSS |
| 有 `package.json`、無框架 | 同上 | 純 HTML |
| 空目錄 | `npm init -y` ＋ 兩個 package | 純 HTML |

- Angular 環境裝之前先 `npm view @dsc-ai-project/ng-ui peerDependencies --json` 對一下 Angular 主版號，版本不合裝下去只會壞在 build。
- **不擅自 scaffold 框架**——空目錄不 `ng new`、不 `create-*`。使用者明確要求才做。
- 目錄非空又沒有 `package.json` 時先問一句再 `npm init`。空目錄與明確的專案目錄直接做。
- **安裝失敗不重試**，把 npm 錯誤翻成白話就停。`@dsc-ai-project` 在 GitHub Packages，裝不起來幾乎都是這三種：`.npmrc` 缺 scope→registry 對應、token 過期或沒過 SSO、peer 版本衝突。訊息要講「在目前這個執行環境裡缺什麼」，因為使用者往往在別台機器上是好的。

### 載入 CSS

```html
<!-- 只載這兩個，不要把所有 theme 都載進來（後載的會蓋掉先載的） -->
<link rel="stylesheet" href="node_modules/@dsc-ai-project/tokens/dist/variables.css">
<link rel="stylesheet" href="node_modules/@dsc-ai-project/tokens/dist/theme-personas.css">
```

非預設 theme 要**同時**換 CSS 檔並在 root 設屬性，只做一半等於沒換：

```html
<html data-theme="aimedia">   <!-- 不設 = personas -->
```

可用值：`personas`（預設）· `snape` · `aimedia` · `wonder` · `ai-creative`。

## Step 1 — 讀素材

用多少讀多少，不用全吞。路徑都在 `node_modules/` 底下：

| 你要做的事 | 讀這裡 | 注意 |
|---|---|---|
| 有哪些元件、各自幹嘛 | `@dsc-ai-project/ng-ui/ds-manifest.json` → `components[].useWhen` | 這是唯一權威。不要憑印象認定某個元件存在 |
| 某個 prop 能填什麼 | 同上 → `inputs[].values` / `.shape` | 開放型別（`File[]`、`Record`、`string \| number \| null`）沒有這兩欄，那是它們本來就沒有固定值 |
| 有哪些狀態、怎麼重現 | 同上 → `states[]` | `args` 是要設的 input，`simulation` 是要用的 CSS 偽類（`hover` / `active` / `focus-visible` / `none`） |
| 鍵盤與焦點該怎麼動 | 同上 → `interactions[]` | 只有 `ds-menu-select`、`ds-context-menu`、`ds-dialog`、`ds-segmented`、`ds-file-upload` 有。**其餘元件沒有契約，不代表沒有行為，是代表沒人保證它** |
| 做「一個畫面」 | 同上 → `patterns[]` | AppShell（全域外框）· Form · ChatWizard（多步 AI 流程）· AITrust（AI 產出的來源標示）· ConfirmDialog · BrandLockup。有對得上的就照 `composes` 起手 |
| 查 token 的值 | `@dsc-ai-project/tokens/dist/tokens.json` | 扁平、已解析、約 10 KB、129 個角色全含 |

**token 命名對照**：語意角色帶 `Ds` 前綴（`DsColorAction` → `--ds-color-action`），primitive 不帶（`Space4` → `--space-4`）。色彩是 hex 字串，gradient 是 `{type, angle, stops}` 物件。

## Step 2 — 讀策略

- [references/raphael-taste-profile.md](references/raphael-taste-profile.md) — **新畫面或新區塊時必讀**（一行小修可略）：核心美學立場、手感細節、困難時刻的傾向、anti-patterns。
- [references/raphael-compact-rubric.md](references/raphael-compact-rubric.md) — 選讀。需要具體手感文法時翻：hero grammar、wizard 文法、漸層公式、transition 節奏、克制預設。

## Step 3 — 產出

**Angular**：直接 `import` 真的 `ds-*` 元件，用 manifest 宣告的 `tag` 與 input 型別。

**其他環境**：不要憑空手刻，DS 有現成素材可抄。**這兩個路徑只能當檔案讀，不能當 package specifier import**——套件的 `exports` 沒開放這些子路徑：

| 要什麼 | 讀 |
|---|---|
| 元件的 CSS | `node_modules/@dsc-ai-project/ng-ui/css/ds-<tag>.css`（`:host` 已翻成 tag selector） |
| 元件的 DOM 結構 | `node_modules/@dsc-ai-project/ng-ui/markup.json` |

`markup.json` 每個元件標了 `portability`，決定你抄完拿到多少：

- **`presentational`**（15 個）— 抄完就等於整個元件。
- **`stateful`**（11 個）— 外觀完整，值與選取邏輯要自己接。
- **`behavioral`**（6 個）— **只有外觀會過去。** 焦點管理、鍵盤操作、ARIA 連線全留在 Angular 那側，要照 manifest 的 `interactions` 自己實作。抄完 CSS 不等於拿到元件。

另外 `markup.json` 的 `$caveat` 有記一個限制：表單狀態已反射成 attribute，但 `data-indeterminate` 只是記錄——元件 CSS 用 `:indeterminate` 偽類，那只吃 DOM property，要用 JS 設。

**最後**：產出檔案開頭加一行 `<!-- ds-sense 產出 -->`（或對應語言的註解格式），讓後續的人知道這是哪來的。

## 容易踩的坑

- **只讀 `variables.css` 會找不到品牌色。** 它只有 brand-invariant 的角色（text / bg / border / radius / type / space / state）。`action`、`brand`、`selection`、`data`、`ai`、shell accent 與四個 gradient 共 28 個角色**只在 theme CSS 裡**。找不到 `--ds-color-action` 就自己編一個藍色，是最常見也最難發現的錯——畫面看起來好好的，換 theme 才爆。查值一律走 `tokens.json`。
- **編譯後的 Angular bundle 不能拿來抄 CSS。** 它的選擇器被 view encapsulation 改寫成 `.ds-button[_ngcontent-xxx]`，在 Angular 之外一個都不會中。要 CSS 就用 `css/` 那份。
- **manifest 是生成物**，不要為了讓它符合你的想像去改它。
