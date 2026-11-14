測試素材（用 ffmpeg 產生，沒有真人）。Chromium 沒有 H.264，所以用 WebM（VP8/Opus）。

- clip-a.webm：testsrc2，320×568 直式，2 秒，有聲音（440Hz）
- clip-b.webm：smptebars，320×568 直式，1.6 秒，沒有聲音
- clip-c.webm：testsrc，480×270 橫式，3 秒，有聲音（660Hz）
- photo.png：400×300 漸層圖
- solid-red.webm / solid-green.webm / solid-blue.webm：純色 320×568 直式，4 秒，沒有聲音（Phase 2 疊圖層測試用，可以用取樣顏色判斷誰在上面）
- mini-font.ttf：從芫荽 Iansui（SIL OFL 1.1，https://github.com/ButTaiwan/iansui）裁切出幾個字的小字體，測試「匯入字體」用

## CI 介面繁中字體

`ui-noto-sans-tc.ttf` 只用於 Linux CI 的系統 UI fallback，不進網站 dist。來源是本 repo 的 `public/fonts/noto-sans-tc/noto-sans-tc-100-900.woff2`，以 fontTools 移除 WOFF2 壓縮封裝保存為 TTF；字形與 cmap 保持不變、保留原內部 VC Subset 名稱。授權：旁邊 `ui-noto-sans-tc-OFL.txt`（與來源 OFL.txt 相同）。轉換命令：

```python
from fontTools.ttLib import TTFont
font = TTFont('public/fonts/noto-sans-tc/noto-sans-tc-100-900.woff2')
font.flavor = None
font.save('tests/fixtures/ui-noto-sans-tc.ttf')
```

原因：runner 的預設 fontconfig 沒有採用 WOFF2 作系統字體，fc-match 仍為 DejaVu Sans。改 TTF 另用 ui-fontconfig.conf 將原 CSS 家族 Noto Sans TC 對應到裁切後的內部家族名稱 Noto Sans TC VC Subset，並在 CI 斷言 fc-match 中字為 Noto Sans TC，避免產出中文字方框截圖。原網站公開 WOFF2、使用者字體及生產程式未變。

2026-11-12：tone-video.webm 為 ffmpeg color=red 160×284/24fps/3 秒，合成 440Hz 正弦波/48kHz/Opus；music.wav 為 660Hz/48kHz/3 秒 PCM。animated-sticker.gif 是自行生成的 120×120 透明背景紅/綠圓，兩格各 300ms、disposal=2，測試透明動畫與匯出，沒有第三方圖片或真人影片。

2026-11-13：timing-video.webm 為自行產生的10秒160×284/24fps紅底，1.5–2.5、4.5–5.5、8.5–9.5秒轉綠，合成440Hz/48kHz聲音，VP8/Opus。特效播放期間用不同秒數的顏色與聲音驗證來源仍前進，沒有使用第三方素材。

2026-11-13：preview-large.webm為ffmpeg自製1920×1080紅底/白色4px細線（x1000）/24fps/2秒、440Hz聲音，VP9 lossless/Opus；測本機540/720真proxy、快取、原檔匯出細節，不含第三方影片。

2026-11-14：timeline-long.webm為ffmpeg自製121秒160×284/2fps/VP8無音訊，0–60秒紅、60秒後藍；每20格keyframe。驗長片及放大時間軸的120格縮圖預算不會截斷後段，縮圖仍對應後半藍色，不需逐幀大量解碼。
