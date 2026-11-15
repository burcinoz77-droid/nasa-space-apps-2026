// Part 1 · Settings = demo control panel: scenario triggers, sampling rate, reset.
// Colors from theme.ts: storm and workload amber, warning scenarios with a red border, stabilize green.
import { controls } from '../../loop';
import { SCENARIOS } from '../../sim/scenario';
import { PARAMS, SIM, type Param } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { ScenarioId, Telemetry } from '../../types';
import { DEMO_EVENT } from '../cinematic/phases';
import { CINEMATIC_EVENT, SHOWS } from '../cinematic/shows';
import { alpha, COLORS, fmt } from '../theme';

const EMPTY: Telemetry[] = [];

interface ScenarioButton {
  id: ScenarioId;
  label: string;
  who: string; // who it affects
  what: string; // what happens
  color: string;
}

const BUTTONS: ScenarioButton[] = [
  { id: 'SOLAR_STORM', label: 'Start solar particle event', who: 'All crew (orbit crew most exposed)', what: 'Dose rate ×25, then ×60. DONKI May 2024 event sequence.', color: COLORS.caution },
  { id: 'MARS_DAY_180', label: 'Mars Day 180 load', who: 'Elif fully, others at half intensity', what: 'Sleep drops to 5 h, PVT slows, mood falls.', color: COLORS.caution },
  { id: 'CO2_SCRUBBER_FAIL', label: 'CO₂ scrubber failure', who: 'Orbit crew, Kerem twice as sensitive', what: 'Cabin ppCO₂ 1.9 → 5.3 mmHg. Breathing and heart rate rise.', color: COLORS.critical },
  { id: 'EVA_OVEREXERTION', label: 'EVA overexertion', who: 'Mert (Surface crew)', what: 'Heart rate 155, core temperature 39.2 °C, lactate 22 mM.', color: COLORS.critical },
  { id: 'NORMAL', label: 'Stabilize all crew', who: 'Everyone', what: 'Scenario effects stop; values recover gradually to personal baseline.', color: COLORS.normal },
];

const SPEEDS = [800, 1200, 2500];
const PARAM_LIST: Param[] = Object.values(PARAMS);

function SourceCell({ p }: { p: Param }) {
  const badge = p.assumption ? (
    <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ color: COLORS.offline, border: `1px solid ${COLORS.offline}` }}>Assumption</span>
  ) : null;
  if (!p.url) return <span style={{ color: COLORS.textMuted }}>{p.source}{badge}</span>;
  return (
    <span>
      <a href={p.url} target="_blank" rel="noreferrer" className="underline decoration-dotted" style={{ color: COLORS.calm }}>{p.source}</a>
      {badge}
    </span>
  );
}

export function SettingsPage() {
  const tickMs = useAstra((s) => s.tickMs);
  const ship = useAstra((s) => s.ship);
  const samples = useAstra((s) => s.history.elif ?? EMPTY).length;
  const baselineReady = samples >= SIM.baselineWindow;
  const activeName = ship ? (SCENARIOS[ship.scenario]?.name ?? ship.scenario) : '—';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-space-border bg-space-panel p-4 lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Crisis scenarios</h2>
          <span className="text-sm" style={{ color: COLORS.textMuted }}>
            Active: <span style={{ color: COLORS.text }}>{activeName}</span>
          </span>
        </div>
        {!baselineReady && (
          <p className="mb-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: COLORS.calm, color: COLORS.calm }}>
            Building personal baselines ({samples}/{SIM.baselineWindow} readings). Start a scenario after this, otherwise Layer 1 will learn the anomaly as normal.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {BUTTONS.map((b) => {
            const active = ship?.scenario === b.id;
            return (
              <button
                key={b.id}
                onClick={() => controls.setScenario(b.id)}
                className="rounded-xl border-2 p-3 text-left transition hover:bg-white/5"
                style={{ borderColor: active ? b.color : `${b.color}55`, background: active ? `${b.color}1A` : undefined }}
              >
                <div className="font-semibold" style={{ color: b.color }}>
                  {active ? '● ' : ''}
                  {b.label}
                </div>
                <div className="mt-1 text-sm" style={{ color: COLORS.text }}>{b.what}</div>
                <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>{b.who}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <h2 className="mb-3 font-semibold">Telemetry sampling rate</h2>
          <div className="flex gap-2">
            {SPEEDS.map((ms) => (
              <button key={ms} onClick={() => controls.setSpeed(ms)} className={`rounded-lg px-3 py-2 font-mono ${tickMs === ms ? 'bg-calm/20 text-calm' : 'bg-white/5'}`}>
                {fmt(ms / 1000, 1)} s
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
            1 reading = {SIM.missionMinutesPerTick} min of mission time (demo acceleration).
          </p>
        </section>

        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <h2 className="mb-2 font-semibold">Active events</h2>
          {ship && ship.activeEvents.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {ship.activeEvents.map((e) => (
                <li key={e}>▲ {e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: COLORS.textMuted }}>No events.</p>
          )}
          {ship && SCENARIOS[ship.scenario]?.note && (
            <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>{SCENARIOS[ship.scenario]?.note}</p>
          )}
        </section>

        <section className="rounded-2xl border border-space-border bg-space-panel p-4">
          <button onClick={() => controls.reset()} className="w-full rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
            Reset simulation
          </button>
          <p className="mt-2 text-xs" style={{ color: COLORS.textMuted }}>
            Same seed: the demo reproduces the same data every time.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => window.dispatchEvent(new Event(DEMO_EVENT))}
              className="w-full rounded-lg px-3 py-2.5 font-semibold hover:brightness-110"
              style={{ background: alpha(COLORS.ai, 0.25), color: COLORS.text, border: `1px solid ${COLORS.ai}` }}
            >
              ★ Jury demo (≈2 min, fully automatic)
            </button>
            {(Object.keys(SHOWS) as ScenarioId[]).map((id) => (
              <button
                key={id}
                onClick={() => window.dispatchEvent(new CustomEvent(CINEMATIC_EVENT, { detail: id }))}
                className="w-full rounded-lg px-3 py-2 hover:bg-white/10"
                style={{ background: alpha(COLORS.caution, 0.12), color: COLORS.caution }}
              >
                ▶ Cinematic: {SCENARIOS[id]?.name ?? id}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-space-border bg-space-panel p-4 lg:col-span-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Data sources</h2>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {PARAM_LIST.length} parameters · {PARAM_LIST.filter((p) => p.assumption).length} assumptions · all astronaut data is simulated
          </span>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-space-panel text-left" style={{ color: COLORS.textMuted }}>
              <tr>
                <th className="py-1 pr-3 font-normal">Parameter</th>
                <th className="py-1 pr-3 font-normal">Value</th>
                <th className="py-1 pr-3 font-normal">Reference range</th>
                <th className="py-1 font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_LIST.map((p) => (
                <tr key={p.label} className="border-t border-space-border">
                  <td className="py-1.5 pr-3">{p.label}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                    {fmt(p.value, Number.isInteger(p.value) ? 0 : 2)} <span style={{ color: COLORS.textMuted }}>{p.unit}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                    {p.normalRange ? `${fmt(p.normalRange[0], Number.isInteger(p.normalRange[0]) ? 0 : 1)}–${fmt(p.normalRange[1], Number.isInteger(p.normalRange[1]) ? 0 : 1)}` : '—'}
                  </td>
                  <td className="py-1.5"><SourceCell p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
          Solar particle event times come from NASA DONKI May 2024 records (data/donki_sep_2024-05.json). DONKI gives no dose values: the storm peak multiplier is based on Curiosity's cruise measurement and the shelter factor on Artemis I; onset and surface multipliers are assumptions. Layer 1 raises no alert for values inside the "Normal range" column.
        </p>
      </section>
    </div>
  );
}
