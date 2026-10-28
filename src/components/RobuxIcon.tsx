export default function RobuxIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="m16 3 11 6.5v13L16 29 5 22.5v-13Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 12h8v8h-8z" fill="currentColor" />
    </svg>
  );
}
