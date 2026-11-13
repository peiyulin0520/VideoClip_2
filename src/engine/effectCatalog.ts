import type { TransitionPreset, VideoEffectPreset } from '../model/types';
export const TRANSITIONS: { id: TransitionPreset; label: string; category: string }[] = [
  { id: 'crossfade', label: '疊化', category: '基本' },
  ...(['left', 'right', 'up', 'down'] as const).map((d, i) => ({
    id: `push-${d}` as TransitionPreset,
    label: ['向左推移', '向右推移', '向上推移', '向下推移'][i]!,
    category: '相機動作',
  })),
  { id: 'slide-left', label: '由右滑入', category: '相機動作' },
  { id: 'slide-right', label: '由左滑入', category: '相機動作' },
  ...(['left', 'right', 'up', 'down'] as const).map((d, i) => ({
    id: `wipe-${d}` as TransitionPreset,
    label: ['向左擦除', '向右擦除', '向上擦除', '向下擦除'][i]!,
    category: '基本',
  })),
  { id: 'split-horizontal', label: '上下分割', category: '基本' },
  { id: 'split-vertical', label: '左右分割', category: '基本' },
  { id: 'grid4', label: '四宮格', category: '特效' },
  { id: 'grid9', label: '九宮格', category: '特效' },
  { id: 'zoom-in', label: '拉近鏡頭', category: '相機動作' },
  { id: 'zoom-out', label: '拉遠鏡頭', category: '相機動作' },
  { id: 'spin', label: '旋轉換景', category: '相機動作' },
  { id: 'page-turn', label: '翻頁', category: '特效' },
  { id: 'blur', label: '模糊轉場', category: '基本' },
  { id: 'glitch', label: '故障切換', category: '故障' },
  { id: 'film-up', label: '膠片上移', category: '特效' },
  { id: 'film-left', label: '膠片左移', category: '特效' },
  { id: 'projector', label: '放映機切片', category: '特效' },
  { id: 'circle', label: '圓形展開', category: '基本' },
];
export const VIDEO_EFFECTS: {
  id: VideoEffectPreset;
  label: string;
  category: string;
  description: string;
}[] = [
  { id: 'shake', label: '手持震動', category: '相機動作', description: '畫面隨時間輕微晃動。' },
  { id: 'pulse', label: '節奏縮放', category: '相機動作', description: '鏡頭反覆拉近再回復。' },
  { id: 'soft-blur', label: '柔焦', category: '基本', description: '讓影像柔和模糊。' },
  { id: 'mono', label: '黑白電影', category: '基本', description: '降低色彩，留下黑白明暗。' },
  { id: 'warm-tone', label: '暖色底片', category: '基本', description: '偏暖的膠片色溫。' },
  { id: 'cool-tone', label: '冷色電影', category: '基本', description: '偏冷的藍色色溫。' },
  { id: 'grain', label: '底片顆粒', category: '特效', description: '隨影格改變的細小顆粒。' },
  { id: 'glitch-video', label: '數位干擾', category: '故障', description: '水平切片錯位與閃動。' },
  { id: 'rgb-split', label: '色散重影', category: '故障', description: '紅藍分離的動態重影。' },
  { id: 'vignette', label: '暗角', category: '特效', description: '四周暗下來，集中注意力。' },
  { id: 'snow', label: '飄雪', category: '自然', description: '白色粒子由上往下飄落。' },
  { id: 'sparkle', label: '星光', category: '自然', description: '隨時間閃爍的小星光。' },
];
