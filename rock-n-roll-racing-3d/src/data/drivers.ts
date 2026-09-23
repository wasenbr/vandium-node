import type { AiProfile } from '../sim/ai';

export interface Opponent {
  name: string;
  color: number;
  vehicleId: string;
  ai: AiProfile;
}

/** Rivais da CPU (nomes do original). Em Chem VI, divisão B, correm de Dirt Devil e Marauder. */
export const CHEM6_OPPONENTS: Opponent[] = [
  { name: 'Rip', color: 0xd8d8d8, vehicleId: 'marauder', ai: { skill: 0.75, aggression: 0.7, lane: 1.5 } },
  { name: 'Shred', color: 0xe07a1a, vehicleId: 'dirtdevil', ai: { skill: 0.85, aggression: 0.45, lane: -1.5 } },
  { name: 'Viper Mackay', color: 0x2fc840, vehicleId: 'marauder', ai: { skill: 0.9, aggression: 0.85, lane: 0 } },
];
