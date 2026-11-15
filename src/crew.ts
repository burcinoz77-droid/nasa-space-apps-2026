// ARES-1 crew: six fictional astronauts. The mission titles are real crew titles
// (Commander, Flight Engineer, Mission Specialist, Crew Medical Officer). No real astronaut's name or health data is used.
import type { CrewId, CrewMember } from './types';

export const CREW: CrewMember[] = [
  { id: 'elif', name: 'Dr. Elif Yilmaz', role: 'Mission Specialist · Crew Medical Officer', location: 'KOKPIT', unit: 'IVA-01', sensitivity: 'EVA radiation sensitivity' },
  { id: 'kerem', name: 'Kerem Demir', role: 'Flight Engineer', location: 'KOKPIT', unit: 'IVA-02', sensitivity: 'High cabin CO₂ sensitivity' },
  { id: 'zeynep', name: 'Zeynep Arslan', role: 'Commander', location: 'KOKPIT', unit: 'IVA-03', sensitivity: 'High-G and cardiac resilience' },
  { id: 'emir', name: 'Emir Celik', role: 'Mission Specialist · Scientist', location: 'GEZEGEN', unit: 'xEMU-01', sensitivity: 'Circadian and surface radiation monitoring' },
  { id: 'deniz', name: 'Deniz Ozkan', role: 'Flight Engineer · Surface Systems', location: 'GEZEGEN', unit: 'xEMU-02', sensitivity: 'Low-gravity musculoskeletal load' },
  { id: 'mert', name: 'Mert Sahin', role: 'Mission Specialist · Geologist', location: 'GEZEGEN', unit: 'xEMU-03', sensitivity: 'Surface exploration and metabolic adaptation' },
];

export const CREW_IDS = CREW.map((c) => c.id) as CrewId[];
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c])) as Record<CrewId, CrewMember>;
