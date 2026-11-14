# 音訊爆音與特效預覽連續性

使用者回報音訊些微爆音及加特效可能卡/跳幀，要求先確認解決並繼續。PR11仍未合併，於其分支整合。

## 音訊
AudioBus雖setTarget，Player仍native muted/立即pause/seek，會繞過漸變。新AudioContext線性12ms fade，cancelScheduledValues+setValueAtTime明確錨定當前包絡，真實剪段/片尾以AudioClock預排，不靠RAF。pause/seek共用同一次淡出且等音訊時鐘到零，seek合併且舊asset回呼失效；connected元素留native unmuted，以gain靜音。重播邊界依實際media.currentTime校正，不微調有聲素材速率。play確認後先24ms靜音保持再淡入，避免首個decoder block晚到；paused進段先精準seek。Limiter留餘裕/master0.9。AudioRenderer匯出僅真正音訊區間邊界漸變，不在每decoded chunk切音；soft knee平滑抑制過峰；每個GainNode intrinsic初值等於包絡，避免小數樣本邊界漏預設gain1。

## 特效
RGB/故障及多格clone重複copy/upload同一影片。FrameResource按source/crop/mask/dims共享，refs=0才清理，sprite幾何/濾鏡仍各自獨立。呈現frameStamp去重，固定ColorMatrix/filter chain不每幀設定；粒子每個effect canvas重用。≤720 preview的Blur quality1/resolution0.5；高清/匯出保留quality3/resolution1。

## 驗證（已完成）
新增9單元，359全部成功。3新e2e：非零邊界PCM在真實離線輸出與AudioWorklet預覽量測peak/maxJump，剪段/200%音量/暫停重播/seek；18重影共享1buffer、上傳≤呈現frame數+6、無新配置/反覆seek且移除乾淨；柔焦顆粒捲頁/popup後可連播且不反覆配置貼圖。原148回歸保留，151完整及3+30快速全部成功。

- 最終驗收（2026-11-14）：[Actions 43581659661](https://github.com/peiyulin0520/VideoClip_2/actions/runs/43581659661)；驗收程式 `cdc6195a7917b0acadce7a83c656e6a212379d51`，359單元、151 Chromium e2e全過，另3項音訊/特效＋30項快速回歸全過（完整151的子集）。lint/格式/TypeScript/build/Pages/PWA及39字體檢查成功。最後提交僅文件/量測/成功截圖，與驗收程式的產品、測試及設定一致。
- artifact `14109275799`（browser-checks-43581659661，32956407 bytes），ZIP SHA-256 `34a8670383bb9e534a557544ba69a50a28cb1b2ce042b454925bc840885ef9e3` 已核對；187張成功截圖，無失敗context。新audio-effects三圖已人工檢視：合成色塊影片／片尾頁面，不能當聲音或真機FPS的視覺證據；實際聲音以波形量測為準。
- 完整CI量測：100%離線peak0.79999/maxJump0.003982；200%離線peak0.9999998/maxJump0.005799（原診斷0.399）；即時peak0.76850/maxJump0.004122（原診斷0.742），168960個取樣。原始JSON/對照圖見docs/validation；這是本機合成測試素材，不是使用者影片、音量百分比或Safari硬體驗收。

門檻始終為離線maxJump<0.03、即時<0.08、峰值≤1；正常音量0.8峰值也檢查以避免全靜音假通過。對照圖比較實測過程中抓到的缺陷與最終cdc6195，不能解讀成使用者原影片的改善幅度。Safari硬體聲音與真實FPS仍待PLAN §7。
