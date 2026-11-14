# 主時間軸每2秒實際縮圖與舊專案修復

使用者在58秒看到重複首幀、112秒空白，但片段popup overview有後段。舊「有限圖鋪滿」不能視作每2秒真實取圖，舊紅藍長片測試也不能保證各時點不同。

- Asset.filmstrip獨立version1/interval2/duration/frames(time,src)，原thumbs仍為最多8張的overview。
- proxy準備後、開放播放前建完整每2秒cache；Mediabunny檢查decoded frame timestamp/duration覆蓋請求，缺格不複製上一格。原生fallback靜音、內聯、等seek及requestVideoFrameCallback的mediaTime，不play；取消/timeout釋放資源。
- 舊專案沒有完整cache或source duration/times錯誤時重建，寫metadata與歷史快照、不增undo；完整cache重用。無法取到保留null/提示，重開再試，不拿前格假裝。
- Tiles按可見範圍虛擬化，source2秒區間按trimIn/speed對映timeline，保留全片資料；DOM預算不再截斷可見長片。
- probe舊overview不再缺格複製前格，native partial不當作全長等距圖片。

## 最終驗證
- [Actions 43562187791](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43562187791)：驗收程式 `67c14c9c929a6095927d49c76142b881c6a158c6` 的350單元、148 Chromium e2e全過，另30項快速情境全過（完整測試子集）；lint/格式/TypeScript/build/Pages/PWA與39字體檢查成功。artifact `14100619022`，ZIP SHA-256 `ebbfe5f0f370aecbc66d8b34e426eb3fd7a6caf8ac3f65b87c89cea8cda3c2a1` 已核對；184張成功截圖。最後提交僅文件/成功截圖，產品、測試與設定皆與驗收程式一致。PR #11 open未合併，由使用者自行Merge後發布；Safari真機仍待確認。
- 7新單元檢查全長每2秒/舊及缺格cache/trim-speed/長片可見格數/拒絕stale timestamp/缺圖不沿用/undo保存；3新瀏覽器驗63張全唯一/time/像素、58/60/112/124及最大放大、8張重複首幀cache修復/重開且片段不變、停WebCodecs原生備援。原145情境也通過。
- 新3張成功圖timestamped-thumbnails已人工檢視：58秒對應58/60/62，112秒對應112/114/116，放大112仍正確。自製低fps素材只驗縮圖，不當作影片順暢效能證據。
- 首輪25/30修zoom時DOM/React桶同步；第二輪29/30剩測試放大後錯用60pps，現讀真實DOM寬/片長。保留全部來源time/唯一性/可見覆蓋斷言；VP8色矩陣跨解碼路徑像素容差24。先前失敗/取消run只作歷史。
- 本機最終check與diff檢查通過；Safari HEVC/HDR長片及真機原生備援仍待PLAN §7。使用者自行Merge PR11後發布，助手不代合併。
