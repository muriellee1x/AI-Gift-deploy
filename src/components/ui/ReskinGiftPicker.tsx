'use client'

import { RESKIN_GIFTS } from '@/lib/reskin/gifts'

type Props = {
  selectedKey: string
  onSelect: (key: string) => void
  themeKeyword: string
  onThemeChange: (value: string) => void
  disabled?: boolean
}

export default function ReskinGiftPicker({
  selectedKey,
  onSelect,
  themeKeyword,
  onThemeChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-8">
        {RESKIN_GIFTS.map((gift) => {
          const active = selectedKey === gift.key
          return (
            <button
              key={gift.key}
              type="button"
              onClick={() => !disabled && onSelect(gift.key)}
              disabled={disabled}
              className={`flex w-48 flex-col items-start gap-3 transition-opacity ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <div
                className={`aspect-square w-full overflow-hidden rounded-[var(--radius-card)] border transition-colors ${
                  active
                    ? 'border-[color:var(--color-brand-2)]'
                    : 'border-white/50 hover:border-white/20'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gift.displayImage}
                  alt={gift.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <span
                className={`w-full text-center text-14px font-medium transition-colors ${
                  active ? 'text-[color:var(--color-brand-2)]' : 'text-fg'
                }`}
              >
                {gift.name}
              </span>
            </button>
          )
        })}
      </div>

      <div>
        <p className="mb-3 text-h4">输入换肤主题</p>
        <div className="prompt-box px-4 py-3">
          <input
            type="text"
            className="w-full bg-transparent text-body outline-none placeholder:text-fg3"
            placeholder="简单输入主题关键词，例如：圣诞节主题"
            value={themeKeyword}
            onChange={(e) => onThemeChange(e.target.value)}
            disabled={disabled}
            maxLength={100}
          />
        </div>
      </div>
    </div>
  )
}
