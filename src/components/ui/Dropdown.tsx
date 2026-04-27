'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type DropdownValue = string | number

export type DropdownOption<T extends DropdownValue = string> = {
  value: T
  label: ReactNode
  disabled?: boolean
}

type DropdownProps<T extends DropdownValue = string> = {
  value: T | null | undefined
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: ReactNode
  disabled?: boolean
  className?: string
  buttonClassName?: string
  menuClassName?: string
  optionClassName?: string
}

export default function Dropdown<T extends DropdownValue = string>({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  optionClassName = '',
}: DropdownProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  )

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const nextIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : options.findIndex((option) => !option.disabled)

    setHighlightedIndex(nextIndex)
  }, [open, options, selectedIndex])

  const moveHighlight = (direction: 1 | -1) => {
    if (!enabledOptions.length) return

    const currentEnabledIndex = enabledOptions.findIndex(
      (option) => option.value === options[highlightedIndex]?.value
    )
    const baseIndex = currentEnabledIndex >= 0 ? currentEnabledIndex : -1
    const nextEnabledIndex =
      direction === 1
        ? (baseIndex + 1) % enabledOptions.length
        : (baseIndex - 1 + enabledOptions.length) % enabledOptions.length

    const nextValue = enabledOptions[nextEnabledIndex]?.value
    const nextIndex = options.findIndex((option) => option.value === nextValue)
    setHighlightedIndex(nextIndex)
  }

  const commitOption = (option: DropdownOption<T>) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        onKeyDown={(event) => {
          if (disabled) return

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) setOpen(true)
            else moveHighlight(1)
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) setOpen(true)
            else moveHighlight(-1)
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }

            const option = options[highlightedIndex]
            if (option && !option.disabled) {
              commitOption(option)
            }
          }
        }}
        className={`input-box relative flex w-full items-center justify-between gap-3 pr-11 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-fg' : 'text-fg3'}`}>
          {selectedOption?.label ?? placeholder ?? '请选择'}
        </span>
        <span
          className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1 1.25L6 6.25L11 1.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 top-full z-40 mt-2 min-w-full overflow-hidden rounded-[var(--radius-card)] border border-white/12 bg-[rgba(15,15,18,0.96)] shadow-[0_12px_32px_rgba(0,0,0,0.36)] backdrop-blur-xl ${menuClassName}`}
        >
          {options.map((option, index) => {
            const selected = option.value === value
            const highlighted = index === highlightedIndex

            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commitOption(option)}
                className={`flex w-full items-center px-4 py-2.5 text-left text-body transition-colors ${
                  option.disabled
                    ? 'cursor-not-allowed opacity-40'
                    : selected
                      ? 'bg-[rgba(13,109,255,0.2)] text-fg'
                      : highlighted
                        ? 'bg-white/6 text-fg'
                        : 'text-fg3'
                } ${optionClassName}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
