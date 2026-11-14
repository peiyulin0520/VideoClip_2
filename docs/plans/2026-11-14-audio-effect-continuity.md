# 音訊爆音與特效預覽連續性

使用者回報音訊些微爆音及加特效可能卡/跳幀，要求先確認解決並繼續。PR11仍未合併，於其分支整合。

## 音訊
AudioBus雖setTarget，Player仍native muted/立即pause/seek，會繞過漸變。新AudioContext線性12ms fade，cancelAndHold或計算當前包絡hold，真實剪段/片尾以AudioClock預排，不靠RAF。pause/seek等淡出，seek合併且舊asset回呼失效；connected元素留native unmuted，以gain靜音。重播邊界依實際media.currentTime校正，不微調有聲素材速率。Limiter留餘裕/master0.9。AudioRenderer匯出僅真正音訊區間邊界漸變，不在每decoded chunk切音；soft knee平滑抑制過峰。

## 特效
RGB/故障及多格clone重複copy/upload同一影片。FrameResource按source/crop/mask/dims共享，refs=0才清理，sprite幾何/濾鏡仍各自獨立。呈現frameStamp去重，固定ColorMatrix/filter chain不每幀設定；粒子每個effect canvas重用。≤720 preview的Blur quality1/resolution0.5；高清/匯出保留quality3/resolution1。

## 驗證（待CI）
新增7單元（原4個playback stability保留並更新native排程），預期357。3新e2e：非零邊界PCM在真實離線輸出與AudioWorklet預覽量測peak/maxJump，剪段/200%音量/暫停重播/seek；18重影共享1buffer、上傳≤呈現frame數、無新配置/反覆seek且移除乾淨；柔焦顆粒捲頁/popup後可連播且不反覆配置貼圖。其餘148回歸保留，新151完整/33快速。成功後下載本輪artifact、波形JSON與截圖，更新PR11。Safari硬體聲音與真實FPS仍待PLAN §7。
