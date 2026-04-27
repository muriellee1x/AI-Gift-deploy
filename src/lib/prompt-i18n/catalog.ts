import { PROMPT_IDS, type PromptId } from './prompt-ids'
import type { PromptCatalogEntry } from './types'

export const PROMPT_CATALOG: Record<PromptId, PromptCatalogEntry> = {
  [PROMPT_IDS.FISSION_ANALYZE_VIDEO]: {
    pathStem: 'fission/analyze_video',
    variableKeys: ['video_description', 'frame_count', 'video_duration', 'frame_timeline'],
  },
  [PROMPT_IDS.FISSION_THEME_RECOMMEND]: {
    pathStem: 'fission/theme_recommend',
    variableKeys: ['analysis_asset'],
  },
  [PROMPT_IDS.FISSION_CHARACTER_IMAGE_PROMPT]: {
    pathStem: 'fission/character_image_prompt',
    variableKeys: ['analysis_asset', 'selected_theme'],
  },
  [PROMPT_IDS.FISSION_VIDEO_PROMPT]: {
    pathStem: 'fission/video_prompt',
    variableKeys: ['analysis_asset', 'selected_theme', 'character_images_desc'],
  },
  [PROMPT_IDS.RESKIN_ANALYSE]: {
    pathStem: 'reskin/reskin_analyse',
    variableKeys: ['frame_count', 'video_duration', 'frame_timeline'],
  },
  [PROMPT_IDS.RESKIN_VIDEO_PROMPT]: {
    pathStem: 'reskin/reskin_video_prompt',
    variableKeys: ['reskin_analyze'],
  },
}
