import { createAirBlade } from './airblade';
import { createBattleTrak } from './battletrak';
import type { CarVisual } from './common';
import { createDirtDevil } from './dirtdevil';
import { createHavac } from './havac';
import { createMarauder } from './marauder';

export type { CarAnim, CarVisual } from './common';

const BUILDERS: Record<string, (color: number, shadows: boolean) => CarVisual> = {
  dirtdevil: createDirtDevil,
  marauder: createMarauder,
  airblade: createAirBlade,
  battletrak: createBattleTrak,
  havac: createHavac,
};

/** Modelo 3D de cada carro, gerado por código. */
export function createCarMesh(vehicleId: string, color: number, shadows: boolean): CarVisual {
  return (BUILDERS[vehicleId] ?? createMarauder)(color, shadows);
}
