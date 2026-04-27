export type PromptLocale = 'zh' | 'en'

export type PromptVariables = Record<string, string>

export type PromptCatalogEntry = {
  pathStem: string
  variableKeys: string[]
}

import type { PromptId } from './prompt-ids'

export type BuildPromptInput = {
  promptId: PromptId
  locale: PromptLocale
  variables?: PromptVariables
}
