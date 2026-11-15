// Part 3 · Shared card. All panels use the same background, border and corner radius.
// If onClick is given the card also opens with the keyboard (Enter/Space). Since it may contain a link (SourceBadge),
// a <div> with role="button" is used instead of <button> (no nested interactive elements).
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

export function Card({
  title,
  right,
  children,
  className = '',
  style,
  onClick,
  ariaLabel,
  flush = false,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
  flush?: boolean; // no padding (the content provides its own)
}) {
  const body = (
    <>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="min-w-0 truncate text-[15px] font-semibold text-slate-200">{title}</h2>}
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </>
  );
  const cls = `min-w-0 rounded-2xl border border-space-border bg-space-panel ${flush ? '' : 'p-4'} ${className}`;
  if (onClick) {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKey}
        aria-label={ariaLabel}
        className={`${cls} cursor-pointer text-left transition hover:border-calm/60 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-calm`}
        style={style}
      >
        {body}
      </div>
    );
  }
  return (
    <section className={cls} style={style} aria-label={ariaLabel}>
      {body}
    </section>
  );
}
