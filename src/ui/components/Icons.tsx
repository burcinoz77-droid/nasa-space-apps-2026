// Parça 3 · Yan menü ve üst bar simgeleri (çizgi simgeler, currentColor ile boyanır).
import type { ReactNode } from 'react';

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconCockpit() {
  return (
    <Svg>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-5" />
      <circle cx="12" cy="15" r="1.4" />
      <path d="M3 19h18" />
    </Svg>
  );
}

export function IconAstronaut() {
  return (
    <Svg>
      <circle cx="12" cy="9" r="5" />
      <path d="M9.5 9h5" />
      <path d="M5 21c.8-3.5 3.6-6 7-6s6.2 2.5 7 6" />
    </Svg>
  );
}

export function IconCrew() {
  return (
    <Svg>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9.5" r="2.6" />
      <path d="M3 20c.6-3.2 3-5.4 6-5.4s5.4 2.2 6 5.4" />
      <path d="M15.5 14.8c2.6.2 4.6 2 5.1 4.7" />
    </Svg>
  );
}

export function IconTasks() {
  return (
    <Svg>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 9l1.6 1.6L12.5 7.7" />
      <path d="M8 15l1.6 1.6 2.9-2.9" />
      <path d="M14.5 9.5H17M14.5 15.5H17" />
    </Svg>
  );
}

export function IconReports() {
  return (
    <Svg>
      <path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h5" />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  );
}

export function IconBell() {
  return (
    <Svg size={22}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconSignal() {
  return (
    <Svg size={18}>
      <path d="M5 18a10 10 0 0 1 0-12" />
      <path d="M8 15.5a6 6 0 0 1 0-7" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M16 8.5a6 6 0 0 1 0 7" />
      <path d="M19 6a10 10 0 0 1 0 12" />
    </Svg>
  );
}

export function IconReset() {
  return (
    <Svg size={18}>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v4.5h4.5" />
    </Svg>
  );
}

/** Orbitalis logosu: gezegen + eğik yörünge + gemi. NASA ya da başka bir kurumun logosu değildir. */
export function OrbitalisMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="9" fill="currentColor" opacity="0.9" />
      <ellipse cx="20" cy="20" rx="17" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" transform="rotate(-24 20 20)" opacity="0.8" />
      <circle cx="34.5" cy="13.2" r="2.4" fill="currentColor" />
    </svg>
  );
}
