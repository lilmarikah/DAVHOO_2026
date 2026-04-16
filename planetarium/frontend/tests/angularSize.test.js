import { describe, it, expect } from 'vitest';
import {
  angularSizeToScene,
  starPointSize,
  PLANET_ANGULAR_DIAMETERS,
  SUN_ANGULAR_DIAMETER_ARCMIN,
  MOON_ANGULAR_DIAMETER_ARCMIN,
} from '../src/utils/angularSize';

describe('angularSizeToScene', () => {
  it('nagyobb FOV → kisebb scene méret', () => {
    const size60 = angularSizeToScene(30, 60);
    const size10 = angularSizeToScene(30, 10);
    expect(size10).toBeGreaterThan(size60);
  });

  it('nagyobb angular méret → nagyobb scene méret', () => {
    const small = angularSizeToScene(5, 60);
    const big = angularSizeToScene(30, 60);
    expect(big).toBeGreaterThan(small);
  });

  it('nem negatív értéket ad', () => {
    expect(angularSizeToScene(0.1, 120)).toBeGreaterThan(0);
  });

  it('nulla FOV-nál nem dob hibát', () => {
    expect(() => angularSizeToScene(10, 0.001)).not.toThrow();
  });
});

describe('starPointSize', () => {
  it('fényesebb csillag nagyobb', () => {
    expect(starPointSize(-1.46, 60)).toBeGreaterThan(starPointSize(5, 60));
  });

  it('szűkebb FOV → nagyobb pont', () => {
    expect(starPointSize(1, 5)).toBeGreaterThan(starPointSize(1, 60));
  });

  it('mindig pozitív', () => {
    expect(starPointSize(10, 120)).toBeGreaterThan(0);
  });
});

describe('Bolygó angular diameters', () => {
  it('Jupiter a legnagyobb', () => {
    const max = Math.max(...Object.values(PLANET_ANGULAR_DIAMETERS));
    expect(max).toBe(PLANET_ANGULAR_DIAMETERS.jupiter);
  });

  it('Nap ~32 ívperc', () => {
    expect(SUN_ANGULAR_DIAMETER_ARCMIN).toBeCloseTo(32, 0);
  });

  it('Hold ~31 ívperc', () => {
    expect(MOON_ANGULAR_DIAMETER_ARCMIN).toBeCloseTo(31, 0);
  });
});