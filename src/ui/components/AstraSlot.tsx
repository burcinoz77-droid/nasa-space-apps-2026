// Parça 3 · Parça 4'ün mor "ASTRA açıklaması" kutusunu (src/ui/components/AstraExplanation.tsx) olay bandına bağlar.
// Dosya henüz main'de yokken derleme bozulmasın diye glob ile yüklenir (Raporlar sayfasıyla aynı yöntem);
// Parça 4 birleştiği anda kendiliğinden görünür.
import type { ComponentType } from 'react';

type ExplanationProps = { incidentId: string };
const modules = import.meta.glob<{ AstraExplanation?: ComponentType<ExplanationProps> }>('./AstraExplanation.tsx', { eager: true });
const AstraExplanation = Object.values(modules)[0]?.AstraExplanation;

export const hasAstraExplanation = !!AstraExplanation;

export function AstraSlot({ incidentId }: ExplanationProps) {
  if (!AstraExplanation) return null;
  return <AstraExplanation incidentId={incidentId} />;
}
