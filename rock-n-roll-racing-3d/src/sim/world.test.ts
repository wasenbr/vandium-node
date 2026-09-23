import { describe, expect, it } from 'vitest';
import { CHEM6_OPPONENTS } from '../data/drivers';
import { TRACKS } from '../data/tracks';
import { VEHICLES } from '../data/vehicles';
import { emptyInput } from './input';
import { Track } from './track';
import { createWorld, stepWorld, type RacerEntry } from './world';

const DT = 1 / 60;
const track = new Track(TRACKS[0]);

function aiEntries(): RacerEntry[] {
  return CHEM6_OPPONENTS.map((o) => ({ name: o.name, color: o.color, spec: VEHICLES[o.vehicleId], ai: o.ai }));
}

describe('mundo da corrida', () => {
  it('3 pilotos da CPU completam uma corrida de 2 voltas', () => {
    const world = createWorld(track, aiEntries(), 2, 42);
    world.started = true;
    for (let i = 0; i < 60 * 240 && world.finishedCount < 3; i++) stepWorld(world, {}, DT);
    expect(world.finishedCount).toBe(3);
    const places = world.racers.map((r) => r.finishPlace).sort();
    expect(places).toEqual([1, 2, 3]);
    // o vencedor leva o prêmio
    const winner = world.racers.find((r) => r.finishPlace === 1)!;
    expect(winner.money).toBeGreaterThanOrEqual(20000);
  });

  it('é determinístico: mesma semente, mesmo resultado', () => {
    const run = () => {
      const w = createWorld(track, aiEntries(), 1, 7);
      w.started = true;
      for (let i = 0; i < 60 * 30; i++) stepWorld(w, {}, DT);
      return w.racers.map((r) => [r.car.x.toFixed(6), r.car.z.toFixed(6), r.armor]);
    };
    expect(run()).toEqual(run());
  });

  it('míssil acerta o carro da frente e causa dano', () => {
    const entries: RacerEntry[] = [
      { name: 'Alvo', color: 0, spec: VEHICLES.marauder, ai: null },
      { name: 'Atirador', color: 0, spec: VEHICLES.havac, ai: null },
    ];
    const world = createWorld(track, entries, 4, 1);
    // coloca o atirador logo atrás do alvo, na mesma faixa
    const shooter = world.racers[1];
    const target = world.racers[0];
    shooter.car.x = target.car.x - Math.sin(target.car.heading) * 10;
    shooter.car.z = target.car.z - Math.cos(target.car.heading) * 10;
    shooter.car.heading = target.car.heading;
    world.started = true;
    stepWorld(world, { 1: { ...emptyInput(), fire: true } }, DT);
    expect(world.projectiles.length).toBe(1);
    for (let i = 0; i < 60; i++) stepWorld(world, {}, DT);
    expect(target.armor).toBeLessThan(target.spec.armor);
  });

  it('carro sem blindagem explode e reaparece', () => {
    const entries: RacerEntry[] = [
      { name: 'A', color: 0, spec: VEHICLES.marauder, ai: null },
      { name: 'B', color: 0, spec: VEHICLES.havac, ai: null },
    ];
    const world = createWorld(track, entries, 4, 1);
    const target = world.racers[0];
    target.armor = 5;
    world.hazards.push({ id: 99, kind: 'mine', owner: 1, x: target.car.x, y: target.car.y, z: target.car.z, age: 10 });
    world.started = true;
    stepWorld(world, {}, DT);
    expect(target.alive).toBe(false);
    expect(world.events.some((e) => e.type === 'explode')).toBe(true);
    for (let i = 0; i < 60 * 3; i++) stepWorld(world, {}, DT);
    expect(target.alive).toBe(true);
    expect(target.armor).toBe(target.spec.armor);
  });
});
