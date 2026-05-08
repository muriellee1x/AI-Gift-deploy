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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {RESKIN_GIFTS.map((gift) => {
          const active = selectedKey === gift.key
          return (
            <button
              key={gift.key}
              type="button"
              onClick={() => !disabled && onSelect(gift.key)}
              disabled={disabled}
              className={`content-card flex flex-col items-center gap-3 p-4 text-left transition-[border-color,background-color] ${
                active
                  ? 'border-[color:var(--color-brand-2)] bg-[rgba(13,109,255,0.08)]'
                  : 'hover:border-white/20'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <div className="h-[120px] w-full overflow-hidden rounded-[var(--radius-card)] bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gift.displayImage}
                  alt={gift.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-body">{gift.name}</span>
                <span
                  className={`chip shrink-0 ${
                    active
                      ? '!bg-[rgba(13,109,255,0.2)] !text-[color:var(--color-brand-2)]'
                      : 'bg-white/10 text-fg3'
                  }`}
                >
                  {active ? '已选' : gift.ratio}
                </span>
              </div>
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
            placeholder="输入一个主题，例如：森林风、莫兰迪、太空"
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
