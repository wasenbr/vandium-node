import type { VehicleSpec } from '../sim/vehicle';

/**
 * Os 5 carros do original. Valores iniciais de protótipo — serão ajustados
 * quando entrarem loja e upgrades (motor, pneus, suspensão, blindagem).
 */
const base = { halfWidth: 1.1, halfLength: 2.1, nitroCharges: 3, drag: 0.12, brake: 40, reverseMax: 11 };

export const VEHICLES: Record<string, VehicleSpec> = {
  dirtdevil: { ...base, id: 'dirtdevil', name: 'Dirt Devil', maxSpeed: 32, accel: 20, steerRate: 2.5, grip: 7, nitroAccel: 22 },
  marauder: { ...base, id: 'marauder', name: 'Marauder', maxSpeed: 36, accel: 23, steerRate: 2.7, grip: 9, nitroAccel: 26 },
  airblade: { ...base, id: 'airblade', name: 'Air Blade', maxSpeed: 40, accel: 25, steerRate: 2.6, grip: 3.5, nitroAccel: 28 },
  battletrak: { ...base, id: 'battletrak', name: 'Battle Trak', maxSpeed: 33, accel: 19, steerRate: 2.3, grip: 12, nitroAccel: 24, halfWidth: 1.25 },
  havac: { ...base, id: 'havac', name: 'Havac', maxSpeed: 42, accel: 27, steerRate: 2.8, grip: 9.5, nitroAccel: 30 },
};
