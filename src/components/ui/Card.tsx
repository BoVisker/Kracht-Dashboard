import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-border bg-card-bg p-5 ${className}`}>
      {title && <h2 className="mb-1 text-base font-semibold text-text-primary">{title}</h2>}
      {subtitle && <p className="mb-3 text-sm text-text-secondary">{subtitle}</p>}
      {children}
    </section>
  )
}
