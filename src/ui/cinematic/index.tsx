// Parça 1 · Senaryo sinematikleri: senaryo değişince o senaryonun sinematiği tam ekran oynar.
// Tekrar oynatmak için: window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: senaryoId }))
// Yeni sinematik eklemek: SHOWS'a bir satır.
import { useEffect, useRef, useState } from 'react';
import { useAstra } from '../../store';
import type { ScenarioId } from '../../types';
import { CINEMATIC_END_EVENT, CINEMATIC_EVENT, runtime } from './phases';
import { SHOWS } from './shows';

export function ScenarioCinematics() {
  const [playing, setPlaying] = useState<{ id: ScenarioId; run: number } | null>(null);
  const scenario = useAstra((s) => s.ship?.scenario);
  const prev = useRef(scenario);

  useEffect(() => {
    if (scenario && scenario !== prev.current && SHOWS[scenario]) setPlaying({ id: scenario, run: Date.now() });
    prev.current = scenario;
  }, [scenario]);

  useEffect(() => {
    const replay = (e: Event) => {
      const id = (e as CustomEvent<ScenarioId>).detail;
      if (id && SHOWS[id]) setPlaying({ id, run: Date.now() });
    };
    window.addEventListener(CINEMATIC_EVENT, replay);
    return () => window.removeEventListener(CINEMATIC_EVENT, replay);
  }, []);

  useEffect(() => {
    runtime.cinematicPlaying = Boolean(playing);
  }, [playing]);

  if (!playing) return null;
  const Show = SHOWS[playing.id]!;
  return (
    <Show
      key={playing.run}
      onClose={() => {
        setPlaying(null);
        window.dispatchEvent(new Event(CINEMATIC_END_EVENT));
      }}
    />
  );
}
