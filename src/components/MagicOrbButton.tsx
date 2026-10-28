import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { admitted?: boolean }

/** Guest liquid-glass capsule. Decorative layers never intercept input. */
export function MagicOrbButton({ children, admitted = false, className = '', ...props }: Props) {
  return <button type="button" {...props} className={`claim-button orb-button${admitted ? ' orb-admitted' : ''} ${className}`}>
    <span className="orb-visual" aria-hidden="true">
      <span className="orb-halo" />
      <span className="orb-sphere">
        <span className="orb-settling">
        <span className="orb-liquid orb-liquid-deep" />
        <span className="orb-liquid orb-liquid-front" />
        <svg className="orb-meniscus" viewBox="0 0 300 72" preserveAspectRatio="none" focusable="false">
          <path d="M-20 31 C22 20 49 34 86 29 S148 21 191 28 S255 35 320 24 L320 85 H-20Z" fill="#aa80d3" fillOpacity=".19" />
          <path d="M-20 31 C22 20 49 34 86 29 S148 21 191 28 S255 35 320 24" fill="none" stroke="#d5baf4" strokeOpacity=".42" strokeWidth=".65" />
        </svg>
        <span className="orb-caustic" />
        <span className="orb-shimmer" />
        </span>
        <span className="orb-glass" />
        <span className="orb-reflection" />
        <span className="orb-glint" />
      </span>
    </span>
    <span className="orb-label">{children}</span>
  </button>
}
