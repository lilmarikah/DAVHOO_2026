import { describe, it, expect } from 'vitest';
import {
  dateToJulianDate,
  julianDateToGMST,
  calculateLST,
  calculateSunPosition,
  calculateMoonPosition,
  calculatePlanetPosition,
} from '../src/utils/astronomy';

describe('Julian Date', () => {
  it('J2000.0 epocha', () => {
    const j2000 = new Date('2000-01-01T12:00:00Z');
    expect(dateToJulianDate(j2000)).toBeCloseTo(2451545.0, 1);
  });

  it('monoton növekvő', () => {
    const d1 = dateToJulianDate(new Date('2020-01-01T00:00:00Z'));
    const d2 = dateToJulianDate(new Date('2021-01-01T00:00:00Z'));
    expect(d2).toBeGreaterThan(d1);
  });
});

describe('GMST', () => {
  it('0-24h tartomány', () => {
    const jd = dateToJulianDate(new Date('2024-06-15T12:00:00Z'));
    const gmst = julianDateToGMST(jd);
    expect(gmst).toBeGreaterThanOrEqual(0);
    expect(gmst).toBeLessThan(24);
  });
});

describe('LST', () => {
  it('0-24h tartomány', () => {
    const lst = calculateLST(new Date(), 19.04);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(24);
  });

  it('keleti hosszúság növeli', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const diff = ((calculateLST(date, 90) - calculateLST(date, 0)) + 24) % 24;
    expect(diff).toBeCloseTo(6, 0);
  });
});

describe('Nap pozíció', () => {
  it('RA 0-24h', () => {
    const pos = calculateSunPosition(new Date());
    expect(pos.ra).toBeGreaterThanOrEqual(0);
    expect(pos.ra).toBeLessThan(24);
  });

  it('Dec ±24° között', () => {
    for (let m = 0; m < 12; m++) {
      const pos = calculateSunPosition(new Date(2024, m, 15));
      expect(pos.dec).toBeGreaterThan(-24);
      expect(pos.dec).toBeLessThan(24);
    }
  });
});

describe('Hold pozíció', () => {
  it('fázis 0-1', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.phase).toBeGreaterThanOrEqual(0);
    expect(pos.phase).toBeLessThanOrEqual(1);
  });

  it('megvilágítás 0-1', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.illumination).toBeGreaterThanOrEqual(0);
    expect(pos.illumination).toBeLessThanOrEqual(1);
  });
});