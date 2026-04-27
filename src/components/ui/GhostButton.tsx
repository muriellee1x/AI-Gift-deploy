'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

const GhostButton = forwardRef<HTMLButtonElement, Props>(function GhostButton(
  { className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn-ghost-pill ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export default GhostButton
