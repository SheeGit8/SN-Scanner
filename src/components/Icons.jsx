export function ScanTextIcon(props) {
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" {...props}>
      <path d="M2 9V2h9M37 2h9v7M46 23v7h-9M11 30H2v-7" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <text x="24" y="20.5" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700" fontSize="11" fill="currentColor">
        S/N
      </text>
    </svg>
  )
}

export function BarcodeIcon(props) {
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" {...props}>
      {[0, 4, 7, 12, 15, 19, 24, 27, 32, 36, 39, 44].map((x, i) => (
        <rect key={x} x={x} y="0" width={i % 3 === 0 ? 3 : 1.6} height="32" fill="currentColor" />
      ))}
    </svg>
  )
}

export function BackIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TrashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
