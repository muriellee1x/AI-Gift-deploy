'use client'

import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  rightSlot?: ReactNode
}

const PillInput = forwardRef<HTMLInputElement, Props>(function PillInput(
  { className = '', rightSlot, ...rest },
  ref,
) {
  if (rightSlot) {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          className={`input-pill pr-12 ${className}`}
          {...rest}
        />
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center text-fg3">
          {rightSlot}
        </div>
      </div>
    )
  }

  return <input ref={ref} className={`input-pill ${className}`} {...rest} />
})

export default PillInput
