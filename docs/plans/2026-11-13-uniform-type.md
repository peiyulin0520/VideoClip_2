# 全介面等字級與文字框內距

使用者確認：除了註解，全部介面文字同樣大；有字的框內距再縮小。PR #9 尚未合併，在同一 PR 補正。

- 首頁、設定、頂部標題/專案名稱、播放時間及圖示標籤、時間軸刻度/群組/素材標籤、下方功能、所有選項與 popup 一律14px。
- 只有明確說明用11px；small 不等於註解，主題名稱、群組數與起迄標籤要14px。
- UI 文字框左右內距6px，輸入框上下4px；縮小群組/區塊/色彩按鈕內距，保留44px觸控。主次選項的底色/框線仍保留。
- 窄螢幕播放時間分兩行，不壓住按鈕；影片文字素材仍保留專案字級、字塊框與輸出設定。
- 驗收：313單元/121 Chromium e2e預期，新增情境遍歷實際可見文字節點、設定/首頁/時間軸/彈窗及320px可讀與內距。保存4張自製素材畫面。Safari原生聚焦與觸控待真機。


全介面字級/框內距最終：[Actions 43415119800](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43415119800)：版本 d2e6e912e29b2b2608590eb828f09a6d1e6e6deb 的313單元、121 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14031444059，ZIP SHA-256 5103eef54febd04d95d5f0855bdfafd9502f4cf35cf186000317ea73181471cc 已核對；152張成功畫面，其中uniform-type/新增4張。PR #9由使用者自行Merge，Safari待真機。


2026-11-13 最新例外：圖層時間軸刻度/分類/標籤11px，計數/原音9px，其他操作介面維持14px。[Actions 43422783991](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43422783991)：版本 fc9d5bb813573aeba69889efe37b1ee98e5786f3 的313單元、127 Chromium e2e全過；lint/格式/TypeScript/build/Pages/39字體檢查成功。artifact 14036880124，ZIP SHA-256 6c1ef4fe7a5b5f2dc4ff8b93335c0138ca2b3a7e3c82b8d16897e19bf15423bb 已核對；159張成功畫面，新增uniform-type/small-timeline-labels.png。Safari待真機。
