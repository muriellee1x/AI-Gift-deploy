'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

const GradientButton = forwardRef<HTMLButtonElement, Props>(function GradientButton(
  { className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn-gradient ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export default GradientButton
