'use client'

export default function StepBar({
  steps,
  current,
  maxReached,
  onStepClick,
}: {
  steps: readonly string[]
  current: number
  maxReached: number
  onStepClick: (idx: number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {steps.map((label, idx) => {
        const isActive = idx === current
        const isReachable = idx <= maxReached

        return (
          <div key={label} className="flex items-center">
            {idx > 0 && (
              <div
                className={`mx-2 h-px w-10 ${
                  idx <= current ? 'bg-[color:var(--color-brand-2)]' : 'bg-white/15'
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => isReachable && onStepClick(idx)}
              disabled={!isReachable}
              className={`flex items-center gap-2 px-1 py-1 text-h4 transition-colors ${
                isActive
                  ? 'text-[color:var(--color-brand-1)]'
                  : isReachable
                  ? 'cursor-pointer text-fg hover:text-fg2'
                  : 'cursor-default text-fg/50'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-h4 ${
                  isActive
                    ? 'bg-gradient-brand text-[#0F0F12]'
                    : isReachable
                    ? 'bg-white/20 text-fg'
                    : 'bg-white/10 text-fg/50'
                }`}
              >
                {idx + 1}
              </span>
              {label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
