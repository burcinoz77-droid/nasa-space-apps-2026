// Part 1 · Scenario cinematics: when the scenario changes, that scenario's cinematic plays full screen.
// To replay: window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: scenarioId }))
// Adding a new cinematic: one line in SHOWS.
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
