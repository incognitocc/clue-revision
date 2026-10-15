# Clue Revision — Handoff

更新日期：2026-10-15（Asia/Taipei）

## 專案與 Git 狀態

- Repository：`git@github.com:incognitocc/clue-revision.git`
- 本機路徑：`/Users/raphael/Documents/Codex/2026-10-12/new-chat/clue-revision`
- 目前工作分支：`UI-design`
- 遠端追蹤分支：`origin/UI-design`
- 本次側欄功能基準 commit：`da53858 Add animated collapsible sidebar`
- `main` 目前停在 `675d71c Add configurable analysis groups to creation flow`

新對話開始時先執行：

```bash
cd /Users/raphael/Documents/Codex/2026-10-12/new-chat/clue-revision
git status --short --branch
git branch --show-current
git log -3 --oneline --decorate
```

後續介面工作請繼續留在 `UI-design`，除非使用者另有指示。

## 啟動本機預覽

```bash
cd /Users/raphael/Documents/Codex/2026-10-12/new-chat/clue-revision/poc
npm start
```

開啟：<http://localhost:5173/>

若 5173 已被使用：

```bash
PORT=5174 npm start
```

此專案是純 HTML／CSS／JavaScript POC，沒有前端框架或執行期套件依賴。

## 最近完成的需求

### 建立分析流程

- 建立分析改為四步驟。
- 在原本第二、第三步之間加入「Step 3：分析組數」。
- 可選擇 1–3 組，選幾組就顯示幾列設定。
- 每組可設定分析內容、分群數量、文章情緒、關鍵字詞性。
- 「分析次數」已改名為「組次」。
- 組次欄縮窄，資料列取消灰底並以淡灰線分隔，第一列上方與最後一列下方都有分隔線。
- 上傳頁已改為拖放／點選上傳框，並移除範本資料與 POC 檔案檢查說明文字。

### 全站左側欄

- 使用 `poc/assets/clue-leftside-bg.mp4` 作為全站左側欄背景。
- 影片設定為自動播放、靜音、無限循環、`playsinline`，並以 `object-fit: cover` 填滿側欄。
- 影片上方沒有半透明色彩遮罩，直接顯示影片原色。
- 目前所在單元維持白色 highlight 與原本深色文字。
- 其他選單與「最近開啟」文字使用白色。
- 桌機版可把側欄收成 72px 窄欄，再重新展開。
- 收合／展開控制位於側欄左下角，距左側與底部各 16px。
- 控制按鈕為 20 × 20px，箭頭圖示為 10 × 10px。
- 點擊桌機側欄的非互動背景也能收合／展開；點擊連結與按鈕不會誤觸切換。
- 行動版仍使用頁首的漢堡選單，不顯示桌機收合按鈕。
- `prefers-reduced-motion: reduce` 時隱藏背景影片。

## 側欄相關檔案

- `poc/index.html`
  - 側欄背景 `<video>`
  - `#sidebar-toggle` 收合／展開按鈕
- `poc/styles/app.css`
  - `.main-nav__video`
  - `.main-nav__collapse`
  - `.nav-collapsed` 桌機窄欄樣式
  - 選取／未選取文字顏色與 responsive 行為
- `poc/js/main.js`
  - `toggleSidebar()`
  - 箭頭按鈕與側欄空白背景 click 行為
- `poc/assets/clue-leftside-bg.mp4`
  - 使用者提供的側欄動畫，約 3.8 MB，300 × 810

## 已完成驗證

- `git diff --check`
- `node --check poc/js/main.js`
- 瀏覽器實測背景影片：`autoplay=true`、`muted=true`、`loop=true`、播放中、無 media error。
- 瀏覽器實測影片上方 `::before` 遮罩不存在。
- 選取項目：白底、深色文字；其他項目：白色文字。
- 箭頭按鈕實測尺寸 20 × 20px，圖示 10 × 10px。
- 箭頭位置實測距側欄左側與底部各 16px。
- 點擊側欄背景可收合與展開；連結不會觸發側欄切換。
- 瀏覽器 console 沒有 error 或 warning。

## 開發注意事項

- 使用者偏好以繁體中文溝通，會逐步微調畫面；每次修改後直接更新本機 preview 並做視覺與互動驗證。
- 不要把 POC 描述成正式 API 或真實 AI 分析；目前使用合成／範本資料。
- 主要架構與完整功能說明請閱讀 `poc/README.md`。
- 不要直接在 `main` 上延續目前 UI 修改；使用 `UI-design` 分支。
- 修改完成後先執行適當檢查，再依使用者要求 commit／push。

## 建議的新對話開場

> 請先閱讀專案根目錄的 `HANDOFF.md` 與 `poc/README.md`，確認目前位於 `UI-design` 分支，然後從現有本機 preview 繼續處理我的 Clue UI 修改。修改後請直接驗證畫面與互動。
