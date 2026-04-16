import { describe, it, expect } from 'vitest';
import {
  raDecTo3D,
  raDecToSpherical,
} from '../src/utils/coordinates';

const R = 100;

describe('raDecTo3D', () => {
  it('RA=0, Dec=0 → x-tengelyen', () => {
    const pos = raDecTo3D(0, 0);
    expect(pos.x).toBeCloseTo(R, 1);
    expect(pos.y).toBeCloseTo(0, 1);
    expect(pos.z).toBeCloseTo(0, 1);
  });

  it('Dec=90 → y-tengely teteje', () => {
    const pos = raDecTo3D(0, 90);
    expect(pos.y).toBeCloseTo(R, 1);
  });

  it('Dec=-90 → y-tengely alja', () => {
    const pos = raDecTo3D(0, -90);
    expect(pos.y).toBeCloseTo(-R, 1);
  });

  it('RA=6h → -z irány', () => {
    const pos = raDecTo3D(6, 0);
    expect(pos.z).toBeCloseTo(-R, 1);
    expect(Math.abs(pos.x)).toBeLessThan(1);
  });

  it('távolság mindig 100 (alapértelmezett sugár)', () => {
    const cases = [
      { ra: 0, dec: 0 },
      { ra: 6, dec: 45 },
      { ra: 12, dec: -30 },
      { ra: 18, dec: 60 },
    ];
    cases.forEach(({ ra, dec }) => {
      const pos = raDecTo3D(ra, dec);
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(dist).toBeCloseTo(R, 1);
    });
  });

  it('egyéni sugár paraméter', () => {
    const pos = raDecTo3D(0, 0, 50);
    expect(pos.x).toBeCloseTo(50, 1);
  });
});

describe('raDecToSpherical', () => {
  it('phi és theta definiált', () => {
    const result = raDecToSpherical(12, 45);
    expect(result).toHaveProperty('phi');
    expect(result).toHaveProperty('theta');
  });

  it('phi 0..PI tartomány (Dec=90 → phi≈0, Dec=-90 → phi≈PI)', () => {
    const north = raDecToSpherical(0, 90);
    const south = raDecToSpherical(0, -90);
    expect(north.phi).toBeCloseTo(0, 0);
    expect(south.phi).toBeCloseTo(Math.PI, 0);
  });
});