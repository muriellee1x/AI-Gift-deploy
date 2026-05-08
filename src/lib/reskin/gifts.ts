export type ReskinGift = {
  key: string
  name: string
  /** 展示缩略图，放在 public/reskin/gifts/，前端直接 <img src={displayImage}> */
  displayImage: string
  /** 绿底原始图（不展示给用户），传给 LLM 和图像生成模型 */
  greenImage: string
  /** 公网可访问视频直链（Cloudflare R2），用于 Seedance reference_video */
  videoUrl: string
  /** 视频时长（秒） */
  duration: number
  /** 宽高比 */
  ratio: '1:1' | '3:4'
}

/**
 * 礼物视频 URL 从 Cloudflare R2 公开 Bucket 获取。
 * 上传后请在 .env 中设置：
 *   NEXT_PUBLIC_R2_GIFT_BASE_URL=https://pub-xxxx.r2.dev/reskin-video-data
 * 修改 .env 后必须重启 dev server（npm run dev）才能生效。
 */
const R2_BASE = process.env.NEXT_PUBLIC_R2_GIFT_BASE_URL || 'PLACEHOLDER'

/**
 * 在 worker handler 入口调用此函数，确保 R2_BASE 已正确配置。
 * 如果 worker 仍然报 PLACEHOLDER 错误，说明 .env 已写入但 dev server 未重启。
 */
export function assertR2Configured(): void {
  if (!process.env.NEXT_PUBLIC_R2_GIFT_BASE_URL || process.env.NEXT_PUBLIC_R2_GIFT_BASE_URL === 'PLACEHOLDER') {
    throw new Error(
      '[reskin] 礼物视频 R2 地址未配置。请在 .env 中设置 NEXT_PUBLIC_R2_GIFT_BASE_URL，然后重启 npm run dev。',
    )
  }
}

export const RESKIN_GIFTS: ReskinGift[] = [
  {
    key: 'bixin-tutu',
    name: '比心兔兔',
    displayImage: '/reskin/gifts/比心兔兔-display.png',
    greenImage: '/reskin/gifts/比心兔兔-image.png',
    videoUrl: `${R2_BASE}/比心兔兔.mp4`,
    duration: 4,
    ratio: '1:1',
  },
  {
    key: 'haohua-youlun',
    name: '豪华邮轮',
    displayImage: '/reskin/gifts/豪华邮轮-display.png',
    greenImage: '/reskin/gifts/豪华邮轮-image.png',
    videoUrl: `${R2_BASE}/豪华邮轮.mp4`,
    duration: 6,
    ratio: '3:4',
  },
  {
    key: 'siren-feiji',
    name: '私人飞机',
    displayImage: '/reskin/gifts/私人飞机-display.png',
    greenImage: '/reskin/gifts/私人飞机-image.png',
    videoUrl: `${R2_BASE}/私人飞机.mp4`,
    duration: 4,
    ratio: '3:4',
  },
  {
    key: 'paoche',
    name: '跑车',
    displayImage: '/reskin/gifts/跑车-display.png',
    greenImage: '/reskin/gifts/跑车-image.png',
    videoUrl: `${R2_BASE}/跑车.mp4`,
    duration: 3,
    ratio: '1:1',
  },
  {
    key: 'reqiqiu',
    name: '热气球',
    displayImage: '/reskin/gifts/热气球-display.png',
    greenImage: '/reskin/gifts/热气球-image.png',
    videoUrl: `${R2_BASE}/热气球.mp4`,
    duration: 3,
    ratio: '3:4',
  },
]

export function findGift(key: string): ReskinGift | undefined {
  return RESKIN_GIFTS.find((g) => g.key === key)
}
