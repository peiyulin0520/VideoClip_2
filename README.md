# Little Moments · VideoClip_2

以 [peiyulin0520/VideoClip](https://github.com/peiyulin0520/VideoClip) 的 `78b178343409c46c7ba353ef3a6db6f279a7bde6`（main，含 PR #3）建立，沿用原專案架構與分階段規格。對外名稱依使用者要求保留 Little Moments。

## 目前版本

已具備多專案、多素材拼接、修剪/分割/變速、多軌疊加、拖移縮放旋轉、字卡排版/描邊/陰影、13 種裝飾、33 種圖形、字體下載/快取/本機匯入、首次使用精靈與 PWA。

仍在規劃中：Fluent Emoji 內建貼圖、雲朵字與完整字卡模板、完整動畫/轉場目錄與調色、進階動態遮罩追蹤、專案備份/Google Drive、IG 音樂推薦。本次新增完整逐格影片與音訊混音、相容即時匯出；格式依瀏覽器編碼能力明示 MP4 或 WebM。先前匯出與第二輪回饋已發布；PR #4 已由使用者合併；本次 PR #5 驗收見下方，細節見 PROGRESS。Google Drive 選項目前只是規劃入口。

原 Sites 的 Little Moments 是另一個版本；這個建立工作不修改原 Sites。兩套模型不同，目前沒有自動轉換專案或素材庫 ZIP，請保留舊資料與原始影片。

## 開發與驗證

建議 Node 22（GitHub Actions 使用 22）；本次環境為 Node 24.22.1，鎖定套件仍相同。

```sh
npm ci
npm run check
npm run e2e -- --trace off
```

`check` 包含 lint、313 個單元測試、TypeScript、正式建置及 GitHub Pages 路徑/PWA/字體檔案檢查。127 個瀏覽器測試（含完整影片/音訊解碼、收藏、GIF、手動遮罩、Key 與主題）交由 GitHub Actions 的 Chromium 153 執行，CI 保存截圖 artifact；最新成功狀態見 PROGRESS.md。本次已更新 159 張 CI 畫面（docs/screenshots）中文可讀；iPhone Safari 仍待真機驗證。

## GitHub Pages

目標儲存庫：https://github.com/peiyulin0520/VideoClip_2

正式網址（已部署並確認 HTTP 200）：https://peiyulin0520.github.io/VideoClip_2/

- Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
- `.github/workflows/deploy.yml`：所有分支執行檢查＋Chromium e2e；只有 `main` 成功後部署 `dist/`。
- 修改流程：功能分支完成修改與適當測試 → 推送 → 建立指向 `main` 的 PR → 提供 PR 連結 → **使用者自行按 Merge pull request**。助手不合併、不開 auto-merge、不直接推送 main，文件更新也一樣。合併後 GitHub Actions 驗收並發布 Pages。分支落後時先整合 main，不 force push。
- 發布後可直接使用，不需要 Codex 或 ChatGPT 持續運作。網址公開，但使用者的影片不會跟著上傳。

## 資料與授權

所有專案/素材/字體仍在使用者裝置。IndexedDB 與 OPFS 使用 `little-moments-videoclip-2`，字體快取為 `lm2-fonts-v1`，localStorage 偏好使用 `lm2-` 前綴；與同網域的 `/VideoClip/` 分開，不搬移或刪除舊資料。PWA scope/id/start_url 固定在 `/VideoClip_2/`。

公開字體只沿用參考庫可再散布的成品及授權。星光小熊貓幼兒體等受限檔案由使用者本機匯入，不放入網站或 repo。

## 接手文件

先讀 [AGENTS.md](AGENTS.md)，再看 [docs/PROGRESS.md](docs/PROGRESS.md) 的交接快照與 [docs/HANDOFF.md](docs/HANDOFF.md)。所有未完成項目與驗收限制均記在文件中。

## 本次 iPhone 編輯體驗更新

補強匯入首格、增加放大預覽、取消浮動圓鈕改兩指、任意顏色/色輪與 RGB、裝飾距離、輪廓柔和與凹槽、可選預覽品質/高密度文字。新增開場秒數/黑白自訂底色，以及拍貼/膠卷/四格相紙（每格獨立素材、滑動效果）。詳細驗收與 Safari 限制見 PROGRESS.md；本次追加完整影片匯出、基本繪畫與自己的跨專案素材庫，詳見下方與 PROGRESS。

完整操作步驟見 [使用說明](docs/USAGE.md)。

操作位置：預覽左下「放大預覽」；選取框內單指拖移、兩指縮放/旋轉；「文字」內切到文字/裝飾/字塊以調整完整色彩、裝飾距離、輪廓；「版型」選多格與每格素材；「剪輯 → 開場留白」調整首支影片起點和底色。

## 本次完整剪輯流程（已發布，驗收見 PROGRESS）

「素材」可加入自己的貼圖、畫作、收藏、留白色塊或搜尋 GIPHY；「音訊」可操作原音/分離音軌及匯入配樂；選取影片後「剪輯 → 裁切」可拖曳四邊或手動套索；頂列「匯出」產生完整影片。設定可換主題/預覽品質，字卡自訂顏色以彈出色輪與 RGB 調整。

GIPHY Key 只儲存在使用者自己的瀏覽器，網站沒有共用 Key；不要把實際 Key 提交到公開 repo。GIPHY 搜尋不進跨專案收藏，已放進專案的 GIF 保留在該專案。自己的素材收藏獨立於專案，刪收藏不刪已使用的素材。字體/專案/收藏與 Key 均不會自動跨手機/瀏覽器同步；不清除網站資料時可重開使用，瀏覽器儲存本身仍非永久備份。

GIF 解碼器 gifuct-js 2.1.2 為 MIT，授權位於 public/licenses。輸出含字幕/文字/色塊/GIF/裁切/音軌；手動遮罩為靜態來源座標，尚無人物自動追蹤。相容匯出需保持頁面開啟。iPhone Safari、長片記憶體與真實 MP4/分享能力仍需真機確認。

## 第二輪手機操作修正

來源影片可用完整來源選區還原，左端修剪會留空白並固定片尾；單一片段可長按跨同類軌道與時間拖移；左側 icon 開軌道設定。字塊填滿與框線顏色/透明度獨立。版型提供位置編號和素材縮圖，支援將現有疊加片段合成單軌多格群組；整組移動/修剪/複製/分割/隱藏/刪除，框架一起處理。裁切新增透明結果預覽與上一筆描邊復原。降低小 GIF 的紋理上傳量並重用影格，Safari 真機流暢度仍待確認。

最新驗收、發布與限制以 [PROGRESS](docs/PROGRESS.md) 為準，操作步驟見 [USAGE](docs/USAGE.md)。

## 工作區捲動調整（PR #1、#2 已合併；參考圖補充 PR #3 已合併）

預覽改為精簡尺寸並隨整頁捲動，時間軸按圖層數完整展開，工具欄接在列表下方。左右控制時間、上下查看圖層；可用「查看圖層」「編輯工具」「回到預覽」跳轉，仍可放大預覽與調整選取框。另修復續用設定的非同步儲存競態。246 單元/72 Chromium e2e 成功，截圖在 docs/screenshots/workspace；Safari 仍需真機確認。[PR #1](https://github.com/peiyulin0520/VideoClip_2/pull/1) 已由使用者合併並部署。

[PR #2](https://github.com/peiyulin0520/VideoClip_2/pull/2) 讓下方字卡、素材等設定也在同一頁自然展開，移除面板固定高度與獨立捲動。246 單元/73 Chromium e2e 通過，新增 workspace/single-page-controls 截圖。此補充已由使用者合併。若仍看到舊版固定大預覽，關閉舊頁籤再重新開啟網址，不需清除網站資料。


## 依連續參考圖調整工作區（PR #3）

預覽恢復正常大小（螢幕高度約六成），預覽與播放列都隨頁面捲走。往下依序是全部圖層、功能欄與選取功能的完整選項。可見圖層條更細，把手更窄，保留方便點選的觸控面積；片尾把手不會被相鄰片段蓋住。

246 單元/74 Chromium e2e 成功，68 張截圖在 docs/screenshots；四張連續畫面為 workspace/reference-*.png。[PR #3](https://github.com/peiyulin0520/VideoClip_2/pull/3) 已由使用者自行合併，iPhone Safari 尚待真機確認。


## 自由影像軌與預覽選取（PR #3 已由使用者合併）

原影片與其他影像都能從預覽直接點選、拖移與兩指縮放。長按顯示該位置的可編輯物件，選擇被蓋住的素材暫時置頂，完成後回原層次；暫時置頂不改儲存順序與匯出。

時間軸長按單一素材，可調時間、跨同類軌道或在層間新建；影像/字卡/音效不混軌，鎖定或跨層占用位置拒絕放置。同軌其他素材不會跟著拖走，原主軌也沒有固定底層限制。多格模板保留群組。明確「插入留白片段」則會在游標切開並推後同軌片段，保留原空隙。

新增米色紙感，已選主題保留，深色媒體區與選取分頁維持對比。262 單元/79 Chromium e2e 通過，80 張截圖在 docs/screenshots，最新十二張在 layer-editing/；Safari 真機仍待確認。[PR #3](https://github.com/peiyulin0520/VideoClip_2/pull/3) 已由使用者自行合併。


## 裁切補邊與倒三角聲音選取（PR #4）

圈選後可用保留筆刷補回缺角、橡皮擦去除多餘範圍，粗細可調並可逐筆復原。手繪增加毛筆、顆粒鉛筆。影片/音訊細部選段使用時間刻度上方小倒三角，保留正常色、未選反灰；音訊可多組保留以排除中間聲音，搭配來源縮圖與當秒畫面，不縮短影片或移動其位置。

新字塊預設無填色，次分類採淺暖色；裝飾距離改為 px 並解釋方向。六主題的自訂色、選取字體/圖層與白字 PNG 預覽都補齊對比。疊色模式有用途說明。0 秒靠左、色塊不重疊就共用一軌；右下浮動回頂有獨立觸控空間。

程式 3b9de60dc2cb325652b075313e1636d47e00f092 / [Actions 43262467680](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43262467680)：267 單元、91 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 107 張驗收圖在 docs/screenshots；[本次畫面](docs/screenshots/refinement/)包括裁切、多段聲音、筆刷、色塊與六種主題字體。[PR #4](https://github.com/peiyulin0520/VideoClip_2/pull/4) 已由使用者自行合併；Safari 真機仍待確認。


## 整組模板、展開故事與特效（PR #5）

時間軸預設收合，需要時可展開全部圖層；頁尾不再保留回頂白帶。膠卷、拍貼與故事都在預覽整組縮放/移動，框架和影片一起改變，點格子仍能選該來源剪片段。各格採共同長度，來源不足補黑/白，可穿插色塊並接續來源；重新套用保留匹配格的調整。

音訊可直接標多組靜音起點/終點、切換標記及移除單組。新增四種基本轉場特效，以及「展開故事」二/三格模板：單片上下展開、多格由上往下依序加入、中央文字快速換三種字體、最後暖光。預覽、單格與完整影片輸出共用。

程式 4d706878f81bae6e311cb866fc62c91047f02b3a / [Actions 43284472645](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43284472645)：278 單元、98 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 118 張截圖已更新，[新驗收畫面](docs/screenshots/story-workspace/)包含收合/頁尾、群組縮放、每格補色、多組靜音、故事階段與特效。[PR #5](https://github.com/peiyulin0520/VideoClip_2/pull/5) 由使用者自行 Merge 後發布；Safari 真機仍待確認。


## 多組選段、圖層批次、線性關鍵幀與效果庫（PR #7）

影片/音訊可在白線位置明確新增多組起迄、取消及局部復原；中間不選處保持原時間空白。素材可命名，長按左側 icon 多選排序/隱藏/刪除/同類合併；影像、文字、貼紙、音訊分別收合。菱形關鍵幀支援位置、大小、旋轉、透明度與亮度/色彩線性變化，膠卷等模板整組一起變。

25 種 A/B 轉場、12 種影片特效，加上既有四種閃光/疊色效果；選項有實際 A/B 動畫示意。GIPHY 無棋盤、已設定 Key 後直接搜尋，變更移到首頁設定；主題改為底色/字色圓圈。用法見 [USAGE](docs/USAGE.md)，[本次畫面](docs/screenshots/advanced-editing/)。

[Actions 43366595525](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43366595525)：版本 c74dec591b3a9bcf88e425b49dbcfdac494d43d5 的 299 單元、110 Chromium e2e 全過，lint/格式/TypeScript/build/Pages/39 字體檢查成功。 [PR #7](https://github.com/peiyulin0520/VideoClip_2/pull/7) 由使用者自行 Merge 後 main Actions 發布；Safari 真機仍待確認。

## 音訊試播、直接定格與轉場操作（PR #8）

音訊小畫面在時間軸旁，同步白線並可暫停標記。定格改在播放列按一下記錄，細調另開；播放與轉場不顯示編輯白框。交接獨立列的圓底＋可進正確 A/B，已用效果與移除在上、選項亮框、同種每交接一次並支援混搭。鉛筆增加可見石墨筆觸，新增硬體壓力/手指速度筆；主次分類、按鈕配色與 GIPHY 純貼圖一併調整。

[Actions 43386450346](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43386450346)：版本 8b61548265b98396fa70d5af4b5e884ff04448b5 的 306 單元、114 Chromium e2e 全數通過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 [PR #8](https://github.com/peiyulin0520/VideoClip_2/pull/8) 由使用者自行 Merge；[本次截圖](docs/screenshots/playback-refinement/)。Safari 待真機。用法見 docs/USAGE.md。

## 分類優先、緊湊選單與偏移剪裁（PR #9）

時間軸先顯示分類摘要，按需要展開；控制字級以功能列為上限、特效三欄只動畫與名稱，版型左圖右選單。鉛筆改紙紋素描、保留單一感壓筆；已選手繪可直接單指拖，輕點仍能選其他素材。播放圖示有短標籤，交接小圓圈不佔獨立列。自由保留/擦除/描邊可用下方控制圈瞄準上方目標，偏移及粗細可調。

[Actions 43408392208](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43408392208)：版本 86d56ad6e41af714ef7b508ad389539fe1312f2b 的 313 單元、120 Chromium e2e 全過；lint/格式/TypeScript/build/Pages/39 字體檢查成功。 [PR #9](https://github.com/peiyulin0520/VideoClip_2/pull/9) 由使用者自行 Merge；[本次畫面](docs/screenshots/compact-workspace/)，用法見 docs/USAGE.md。Safari 待真機。


## 全介面等字級與縮小框內距

全部操作介面14px，明確註解11px，包含首頁/設定/頂部/播放列/時間軸。文字框/按鈕左右6px、輸入框上下4px，保留44px觸控與專案文字素材的原始字級；窄螢幕播放時間兩行。

[Actions 43415119800](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43415119800)：版本 d2e6e912e29b2b2608590eb828f09a6d1e6e6deb 的313單元、121 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。 [驗收畫面](docs/screenshots/uniform-type/)；PR #9由使用者自行Merge，Safari待真機。


## 全頁主題文字對比與收緊字距

首次備份/字體包及文字表面以主題底色和主字/說明色成組設定；六主題逐頁與popup審核。14px操作字距/詞距-0.02em、行高1.25；11px註解字距-0.01em/行高1.3，固定小列更緊。不改專案素材字體或渲染。

[Actions 43420368856](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43420368856)：版本 8fd2969c77b84352a3cd16c7b4f025ae22177792 的313單元、127 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。 [驗收畫面](docs/screenshots/readability/)；PR #9由使用者自行Merge，Safari待真機。


2026-11-13 最新更正：預覽下方的圖層時間軸保留較小字級，刻度、分類與片段名稱11px，群組數及原音9px；其他頁籤、功能、播放列與彈窗仍14px，註解11px。保留收緊字距及44px觸控範圍。


時間軸小字最終：[Actions 43422783991](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43422783991)：版本 fc9d5bb813573aeba69889efe37b1ee98e5786f3 的313單元、127 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。 [時間軸畫面](docs/screenshots/uniform-type/small-timeline-labels.png)。
