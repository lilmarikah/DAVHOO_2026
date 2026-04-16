import { describe, it, expect } from 'vitest';
import {
  brightStars,
  constellationData,
  planets,
  moonData,
  sunData,
  deepSkyObjects,
  galaxies,
  nebulaeData,
  exoplanetsData,
  generateBackgroundStars,
} from '../src/celestialData';

describe('brightStars', () => {
  it('nem üres tömb', () => {
    expect(Array.isArray(brightStars)).toBe(true);
    expect(brightStars.length).toBeGreaterThan(0);
  });

  it('minden csillagnak van id, ra, dec, mag', () => {
    brightStars.forEach(star => {
      expect(star).toHaveProperty('id');
      expect(star).toHaveProperty('ra');
      expect(star).toHaveProperty('dec');
      expect(star).toHaveProperty('mag');
    });
  });

  it('RA 0-24 tartomány', () => {
    brightStars.forEach(star => {
      expect(star.ra).toBeGreaterThanOrEqual(0);
      expect(star.ra).toBeLessThanOrEqual(24);
    });
  });

  it('Dec -90..+90 tartomány', () => {
    brightStars.forEach(star => {
      expect(star.dec).toBeGreaterThanOrEqual(-90);
      expect(star.dec).toBeLessThanOrEqual(90);
    });
  });
});

describe('constellationData', () => {
  it('csillagképek száma > 0', () => {
    expect(constellationData.length).toBeGreaterThan(0);
  });

  it('minden csillagképnek van name és nameHu', () => {
    constellationData.forEach(c => {
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('nameHu');
    });
  });

  it('minden csillagképnek vannak vonalai (lines)', () => {
    constellationData.forEach(c => {
      expect(c).toHaveProperty('lines');
      expect(Array.isArray(c.lines)).toBe(true);
    });
  });
});

describe('planets', () => {
  it('bolygók száma helyes', () => {
    expect(planets.length).toBeGreaterThanOrEqual(7);
  });

  it('minden bolygónak van id, name, color', () => {
    planets.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('color');
    });
  });
});

describe('moonData', () => {
  it('létezik', () => {
    expect(moonData).toBeDefined();
    expect(moonData).toHaveProperty('id');
    expect(moonData).toHaveProperty('name');
  });
});

describe('sunData', () => {
  it('létezik', () => {
    expect(sunData).toBeDefined();
    expect(sunData).toHaveProperty('id');
    expect(sunData).toHaveProperty('name');
  });
});

describe('galaxies', () => {
  it('nem üres', () => {
    expect(Array.isArray(galaxies)).toBe(true);
    expect(galaxies.length).toBeGreaterThan(0);
  });

  it('M31 benne van', () => {
    const m31 = galaxies.find(g => g.id === 'M31');
    expect(m31).toBeDefined();
  });
});

describe('nebulaeData', () => {
  it('nem üres', () => {
    expect(Array.isArray(nebulaeData)).toBe(true);
    expect(nebulaeData.length).toBeGreaterThan(0);
  });
});

describe('generateBackgroundStars', () => {
  it('helyes számú csillagot generál', () => {
    const stars = generateBackgroundStars(500);
    expect(stars.length).toBe(500);
  });

  it('minden csillagnak van ra, dec, mag', () => {
    const stars = generateBackgroundStars(10);
    stars.forEach(s => {
      expect(s).toHaveProperty('ra');
      expect(s).toHaveProperty('dec');
      expect(s).toHaveProperty('mag');
    });
  });
});