'use client'

import Link from 'next/link'
import StepBar from '@/components/ui/StepBar'

export default function SubPageHeader({
  title,
  steps,
  current,
  maxReached,
  onStepClick,
  backHref = '/atomic',
}: {
  title: string
  steps: readonly string[]
  current: number
  maxReached: number
  onStepClick: (idx: number) => void
  backHref?: string
}) {
  return (
    <div className="space-y-4">
      <div className="relative flex h-10 items-center justify-center">
        <Link
          href={backHref}
          className="absolute left-0 flex h-10 items-center gap-1 text-h4 text-fg transition-colors hover:text-fg2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>
        <h1 className="flex h-10 items-center text-h2 text-fg">{title}</h1>
      </div>

      <StepBar
        steps={steps}
        current={current}
        maxReached={maxReached}
        onStepClick={onStepClick}
      />
    </div>
  )
}
