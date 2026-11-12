# Little Moments · VideoClip_2

以 [peiyulin0520/VideoClip](https://github.com/peiyulin0520/VideoClip) 的 `78b178343409c46c7ba353ef3a6db6f279a7bde6`（main，含 PR #3）建立，沿用原專案架構與分階段規格。對外名稱依使用者要求保留 Little Moments。

## 目前版本

已具備多專案、多素材拼接、修剪/分割/變速、多軌疊加、拖移縮放旋轉、字卡排版/描邊/陰影、13 種裝飾、33 種圖形、字體下載/快取/本機匯入、首次使用精靈與 PWA。

仍在規劃中：Fluent Emoji 貼圖、雲朵字與完整模板、動畫/轉場/調色、繪畫/手動剪裁、完整影片 MP4 匯出、專案備份/Google Drive、IG 音樂推薦、跨專案素材庫。程式提供單格 PNG 引擎用於驗證；不能視為已能匯出完整影片。Google Drive 選項目前只是規劃入口。

原 Sites 的 Little Moments 是另一個版本；這個建立工作不修改原 Sites。兩套模型不同，目前沒有自動轉換專案或素材庫 ZIP，請保留舊資料與原始影片。

## 開發與驗證

建議 Node 22（GitHub Actions 使用 22）；本次環境為 Node 24.22.1，鎖定套件仍相同。

```sh
npm ci
npm run check
npm run e2e -- --trace off
```

`check` 包含 lint、227 個單元測試、TypeScript、正式建置及 GitHub Pages 路徑/PWA/字體檔案檢查。50 個瀏覽器測試（本次回歸含首格、觸控、樣式、開場與多格；長修剪/多格綜合流程拆為獨立情境）交由 GitHub Actions 的 Chromium 153 執行，CI 保存截圖 artifact；最新成功狀態見 PROGRESS.md。本次已更新 45 張 CI 畫面（docs/screenshots）中文可讀；iPhone Safari 仍待真機驗證。

## GitHub Pages

目標儲存庫：https://github.com/peiyulin0520/VideoClip_2

正式網址（已部署並確認 HTTP 200）：https://peiyulin0520.github.io/VideoClip_2/

- Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
- `.github/workflows/deploy.yml`：所有分支執行檢查＋Chromium e2e；只有 `main` 成功後部署 `dist/`。
- 專案建立分支：`codex/establish-little-moments`，不自動開 PR。取得寫入授權後，先推送並確認 CI，再以一般 fast-forward 更新新 repo 的 main；若 main 有新提交，先整合，不能 force push。
- 發布後可直接使用，不需要 Codex 或 ChatGPT 持續運作。網址公開，但使用者的影片不會跟著上傳。

## 資料與授權

所有專案/素材/字體仍在使用者裝置。IndexedDB 與 OPFS 使用 `little-moments-videoclip-2`，字體快取為 `lm2-fonts-v1`，localStorage 偏好使用 `lm2-` 前綴；與同網域的 `/VideoClip/` 分開，不搬移或刪除舊資料。PWA scope/id/start_url 固定在 `/VideoClip_2/`。

公開字體只沿用參考庫可再散布的成品及授權。星光小熊貓幼兒體等受限檔案由使用者本機匯入，不放入網站或 repo。

## 接手文件

先讀 [AGENTS.md](AGENTS.md)，再看 [docs/PROGRESS.md](docs/PROGRESS.md) 的交接快照與 [docs/HANDOFF.md](docs/HANDOFF.md)。所有未完成項目與驗收限制均記在文件中。

## 本次 iPhone 編輯體驗更新

補強匯入首格、增加放大預覽、取消浮動圓鈕改兩指、任意顏色/HEX、裝飾距離、輪廓柔和與凹槽、1920/高密度文字。新增開場秒數/黑白自訂底色，以及拍貼/膠卷/四格相紙（每格獨立素材、滑動效果）。詳細驗收與 Safari 限制見 PROGRESS.md；完整影片匯出、繪畫與跨專案素材庫仍未做。

操作位置：預覽左下「放大預覽」；選取框內單指拖移、兩指縮放/旋轉；「文字」內切到文字/裝飾/字塊以調整完整色彩、裝飾距離、輪廓；「版型」選多格與每格素材；「剪輯 → 開場留白」調整首支影片起點和底色。
