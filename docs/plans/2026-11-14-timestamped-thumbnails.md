# 主時間軸每2秒實際縮圖與舊專案修復

使用者在58秒看到重複首幀、112秒空白，但片段popup overview有後段。舊「有限圖鋪滿」不能視作每2秒真實取圖，舊紅藍長片測試也不能保證各時點不同。

- Asset.filmstrip獨立version1/interval2/duration/frames(time,src)，原thumbs仍為最多8張的overview。
- proxy準備後、開放播放前建完整每2秒cache；Mediabunny檢查decoded frame timestamp/duration覆蓋請求，缺格不複製上一格。原生fallback靜音、內聯、等seek及requestVideoFrameCallback的mediaTime，不play；取消/timeout釋放資源。
- 舊專案沒有完整cache或source duration/times錯誤時重建，寫metadata與歷史快照、不增undo；完整cache重用。無法取到保留null/提示，重開再試，不拿前格假裝。
- Tiles按可見範圍虛擬化，source2秒區間按trimIn/speed對映timeline，保留全片資料；DOM預算不再截斷可見長片。
- probe舊overview不再缺格複製前格，native partial不當作全長等距圖片。

## 驗證（待本輪CI）
7新單元：全長取樣/舊及殘缺cache/trim與speed/長片可見格數/拒絕stale timestamp/失敗不沿用/undo快取。3新瀏覽器情境使用126秒、1fps、每2秒換色及標秒自製素材，驗63張唯一圖與真實顏色；58/60/112/124及放大可見覆蓋；8張重複首幀舊cache修復、保存/重開且片段不變；禁WebCodecs後原生fallback仍取到實際後段。更新既有長片及native fallback驗收，其他播放/特效/匯出保留。預期350單元/148完整/30快速，成功後更新全部截圖與新PR，不代Merge。Safari真機仍待PLAN §7。
