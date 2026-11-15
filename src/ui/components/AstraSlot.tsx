// Part 3 · Connects Part 4's purple "ASTRA explanation" box (src/ui/components/AstraExplanation.tsx) to the incident banner.
// Loaded with a glob so the build does not break while the file is not yet on main (same method as the Reports page);
// it appears automatically as soon as Part 4 is merged.
import type { ComponentType } from 'react';

type ExplanationProps = { incidentId: string };
const modules = import.meta.glob<{ AstraExplanation?: ComponentType<ExplanationProps> }>('./AstraExplanation.tsx', { eager: true });
const AstraExplanation = Object.values(modules)[0]?.AstraExplanation;

export const hasAstraExplanation = !!AstraExplanation;

export function AstraSlot({ incidentId }: ExplanationProps) {
  if (!AstraExplanation) return null;
  return <AstraExplanation incidentId={incidentId} />;
}
