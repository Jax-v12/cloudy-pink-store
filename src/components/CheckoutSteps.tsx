type Props = {
  labels: readonly string[];
  current: number;
  ariaLabel: string;
  busy?: boolean;
  onStepChange?: (step: number) => void;
};

export default function CheckoutSteps({ labels, current, ariaLabel, busy = false, onStepChange }: Props) {
  const cols =
    labels.length === 5
      ? 'grid-cols-5'
      : labels.length === 4
        ? 'grid-cols-4'
        : labels.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-2';
  return (
    <ol aria-label={ariaLabel} className={`mx-auto grid w-full max-w-2xl ${cols}`}>
      {labels.map((label, index) => {
        const content = (
          <>
            <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold sm:h-9 sm:w-9 sm:text-sm ${
              index === current ? 'bg-pink-600 text-white ring-4 ring-pink-500/15'
                : index < current ? 'border border-pink-300 bg-pink-100 text-pink-800'
                  : 'border border-[#F1E4ED] bg-white text-[var(--text-secondary)]'
            }`}>
              <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>
            </span>
            <span className={`mt-2 block break-words text-[11px] leading-snug sm:text-xs ${index === current ? 'font-extrabold text-[#251D2C]' : 'font-medium text-[var(--text-secondary)]'}`}>
              {label}
            </span>
          </>
        );
        return (
          <li key={label} aria-current={index === current ? 'step' : undefined} className="relative min-w-0 text-center">
            {index < labels.length - 1 && (
              <span aria-hidden="true" className={`absolute left-1/2 top-5 h-0.5 w-full sm:top-[22px] ${index < current ? 'bg-pink-400' : 'bg-[#F1E4ED]'}`} />
            )}
            {onStepChange ? (
              <button type="button" disabled={index > current || busy} onClick={() => onStepChange(index)} className="relative min-h-11 w-full rounded-xl py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 disabled:cursor-default">
                {content}
              </button>
            ) : <div className="relative py-1">{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}
