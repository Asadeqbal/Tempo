export function TempoLogo({ size = 30, light = false }: { size?: number; light?: boolean }) {
  const boxFill = light ? "#1a2b22" : "#132019";
  const boxStroke = light ? "#2c4436" : "#1e6b57";
  const bars = ["#54c29a", "#c8432f", "#3f7396"];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill={boxFill} stroke={boxStroke} strokeWidth="1.5" />
      <rect x="8" y="9" width="4.5" height="14" rx="2.2" fill={bars[0]} />
      <rect x="14" y="9" width="4.5" height="9" rx="2.2" fill={bars[1]} />
      <rect x="20" y="9" width="4.5" height="12" rx="2.2" fill={bars[2]} />
      <circle cx="22.2" cy="24" r="2.1" fill="#e9c46a" />
    </svg>
  );
}
