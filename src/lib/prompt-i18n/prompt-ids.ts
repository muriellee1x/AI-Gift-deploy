export const PROMPT_IDS = {
  FISSION_ANALYZE_VIDEO: 'fission_analyze_video',
  FISSION_THEME_RECOMMEND: 'fission_theme_recommend',
  FISSION_CHARACTER_IMAGE_PROMPT: 'fission_character_image_prompt',
  FISSION_VIDEO_PROMPT: 'fission_video_prompt',
  RESKIN_ANALYSE: 'reskin_analyse',
  RESKIN_VIDEO_PROMPT: 'reskin_video_prompt',
  RESKIN_IMAGE_PROMPT: 'reskin_image_prompt',
} as const

export type PromptId = (typeof PROMPT_IDS)[keyof typeof PROMPT_IDS]
