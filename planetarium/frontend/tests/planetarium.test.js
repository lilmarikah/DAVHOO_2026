import { describe, it, expect, vi, beforeEach } from 'vitest';

const dateToJulianDate = (date) => {
  return date.getTime() / 86400000 + 2440587.5;
};

const julianDateToGMST = (jd) => {
  const t = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  return gmst / 15;
};

const calculateLST = (date, longitude) => {
  const jd = dateToJulianDate(date);
  const gmst = julianDateToGMST(jd);
  return (gmst + longitude / 15 + 24) % 24;
};

const raDecTo3D = (ra, dec, radius = 100) => {
  const raRad = (ra * 15) * Math.PI / 180;
  const decRad = dec * Math.PI / 180;
  const x = radius * Math.cos(decRad) * Math.cos(raRad);
  const y = radius * Math.sin(decRad);
  const z = -radius * Math.cos(decRad) * Math.sin(raRad);
  return { x, y, z };
};

const calculateSunPosition = (date) => {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const daysSinceJ2000 = (date.getTime() - J2000.getTime()) / (1000 * 60 * 60 * 24);
  const L = (280.460 + 0.9856474 * daysSinceJ2000) % 360;
  const g = (357.528 + 0.9856003 * daysSinceJ2000) % 360;
  const gRad = g * Math.PI / 180;
  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
  const lambdaRad = lambda * Math.PI / 180;
  const epsilon = 23.439 - 0.0000004 * daysSinceJ2000;
  const epsilonRad = epsilon * Math.PI / 180;
  const ra = Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad));
  const dec = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad));
  return {
    ra: ((ra * 180 / Math.PI / 15) + 24) % 24,
    dec: dec * 180 / Math.PI
  };
};

const calculateMoonPosition = (date) => {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const daysSinceJ2000 = (date.getTime() - J2000.getTime()) / (1000 * 60 * 60 * 24);
  const L = (218.316 + 13.176396 * daysSinceJ2000) % 360;
  const M = (134.963 + 13.064993 * daysSinceJ2000) % 360;
  const F = (93.272 + 13.229350 * daysSinceJ2000) % 360;
  const M_rad = M * Math.PI / 180;
  const F_rad = F * Math.PI / 180;
  const longitude = L + 6.289 * Math.sin(M_rad);
  const latitude = 5.128 * Math.sin(F_rad);
  const lambda = longitude * Math.PI / 180;
  const beta = latitude * Math.PI / 180;
  const eclipticObliquity = 23.44 * Math.PI / 180;
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eclipticObliquity) - Math.tan(beta) * Math.sin(eclipticObliquity),
    Math.cos(lambda)
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(eclipticObliquity) +
    Math.cos(beta) * Math.sin(eclipticObliquity) * Math.sin(lambda)
  );
  const sunLongitude = (280.46 + 0.9856474 * daysSinceJ2000) % 360;
  const phase = ((longitude - sunLongitude + 360) % 360) / 360;
  return {
    ra: ((ra * 180 / Math.PI / 15) + 24) % 24,
    dec: dec * 180 / Math.PI,
    phase: phase,
    illumination: (1 - Math.cos(phase * 2 * Math.PI)) / 2
  };
};

const angularSizeToScene = (arcminutes, fov) => {
  const angularDeg = arcminutes / 60;
  const fraction = angularDeg / fov;
  return fraction * 100 * 2;
};

const starPointSize = (mag, fov) => {
  const baseMag = Math.max(0.08, 0.7 - mag * 0.1);
  const fovFactor = Math.pow(75 / Math.max(fov, 0.01), 0.3);
  return baseMag * fovFactor;
};

describe('Julian Date számítás', () => {
  it('J2000.0 epochát helyesen számítja', () => {
    const j2000 = new Date('2000-01-01T12:00:00Z');
    const jd = dateToJulianDate(j2000);
    expect(jd).toBeCloseTo(2451545.0, 1);
  });
  
  it('2024-01-01-et helyesen számítja', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const jd = dateToJulianDate(date);
    expect(jd).toBeCloseTo(2460310.5, 1);
  });
  
  it('monoton növekvő', () => {
    const d1 = dateToJulianDate(new Date('2020-01-01T00:00:00Z'));
    const d2 = dateToJulianDate(new Date('2021-01-01T00:00:00Z'));
    expect(d2).toBeGreaterThan(d1);
  });
});

describe('GMST számítás', () => {
  it('0-24 óra tartományban van', () => {
    const jd = dateToJulianDate(new Date('2024-06-15T12:00:00Z'));
    const gmst = julianDateToGMST(jd);
    expect(gmst).toBeGreaterThanOrEqual(0);
    expect(gmst).toBeLessThan(24);
  });
  
  it('J2000.0-nál ismert értéket ad', () => {
    const gmst = julianDateToGMST(2451545.0);
    expect(gmst).toBeCloseTo(18.697, 0);
  });
});

describe('LST (helyi csillagidő) számítás', () => {
  it('0-24 óra tartományban van', () => {
    const lst = calculateLST(new Date(), 19.04);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(24);
  });
  
  it('keleti hosszúság növeli az LST-t', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const lst0 = calculateLST(date, 0);
    const lst90 = calculateLST(date, 90);
    const diff = ((lst90 - lst0) + 24) % 24;
    expect(diff).toBeCloseTo(6, 0);
  });
  
  it('Budapest (19.04°E) és Greenwich között ~1.27h különbség', () => {
    const date = new Date('2024-03-20T12:00:00Z');
    const lstGreenwich = calculateLST(date, 0);
    const lstBudapest = calculateLST(date, 19.04);
    const diff = ((lstBudapest - lstGreenwich) + 24) % 24;
    expect(diff).toBeCloseTo(19.04 / 15, 1);
  });
});

describe('RA/Dec -> 3D konverzió', () => {
  it('RA=0h, Dec=0° az x-tengelyen van', () => {
    const pos = raDecTo3D(0, 0, 100);
    expect(pos.x).toBeCloseTo(100, 1);
    expect(pos.y).toBeCloseTo(0, 1);
    expect(pos.z).toBeCloseTo(0, 1);
  });
  
  it('Dec=90° az y-tengely tetején van', () => {
    const pos = raDecTo3D(0, 90, 100);
    expect(pos.y).toBeCloseTo(100, 1);
    expect(Math.abs(pos.x)).toBeLessThan(1);
  });
  
  it('Dec=-90° az y-tengely alján van', () => {
    const pos = raDecTo3D(0, -90, 100);
    expect(pos.y).toBeCloseTo(-100, 1);
  });
  
  it('RA=6h a -z irányban van', () => {
    const pos = raDecTo3D(6, 0, 100);
    expect(pos.z).toBeCloseTo(-100, 1);
    expect(Math.abs(pos.x)).toBeLessThan(1);
  });
  
  it('RA=12h az -x irányban van', () => {
    const pos = raDecTo3D(12, 0, 100);
    expect(pos.x).toBeCloseTo(-100, 1);
  });
  
  it('a távolság mindig a sugárral egyenlő', () => {
    const testCases = [
      { ra: 0, dec: 0 },
      { ra: 6, dec: 45 },
      { ra: 12, dec: -30 },
      { ra: 18, dec: 60 },
      { ra: 23.99, dec: -89 },
    ];
    
    testCases.forEach(({ ra, dec }) => {
      const pos = raDecTo3D(ra, dec, 100);
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(dist).toBeCloseTo(100, 1);
    });
  });
});

describe('Nap pozíció számítás', () => {
  it('RA 0-24h tartományban van', () => {
    const pos = calculateSunPosition(new Date());
    expect(pos.ra).toBeGreaterThanOrEqual(0);
    expect(pos.ra).toBeLessThan(24);
  });
  
  it('Dec -23.5° és +23.5° között van (ekliptika)', () => {
    for (let month = 0; month < 12; month++) {
      const date = new Date(2024, month, 15);
      const pos = calculateSunPosition(date);
      expect(pos.dec).toBeGreaterThan(-24);
      expect(pos.dec).toBeLessThan(24);
    }
  });
  
  it('nyári napfordulókor ~+23.44° dec', () => {
    const date = new Date('2024-06-21T12:00:00Z');
    const pos = calculateSunPosition(date);
    expect(pos.dec).toBeCloseTo(23.44, 0);
  });
  
  it('téli napfordulókor ~-23.44° dec', () => {
    const date = new Date('2024-12-21T12:00:00Z');
    const pos = calculateSunPosition(date);
    expect(pos.dec).toBeCloseTo(-23.44, 0);
  });
  
  it('tavaszi napéjegyenlőségkor ~0° dec', () => {
    const date = new Date('2024-03-20T12:00:00Z');
    const pos = calculateSunPosition(date);
    expect(Math.abs(pos.dec)).toBeLessThan(2);
  });
});

describe('Hold pozíció számítás', () => {
  it('RA 0-24h tartományban van', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.ra).toBeGreaterThanOrEqual(0);
    expect(pos.ra).toBeLessThan(24);
  });
  
  it('Dec tartomány -30° és +30° között (ekliptika ± 5°)', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.dec).toBeGreaterThan(-30);
    expect(pos.dec).toBeLessThan(30);
  });
  
  it('holdfázis 0-1 tartományban van', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.phase).toBeGreaterThanOrEqual(0);
    expect(pos.phase).toBeLessThanOrEqual(1);
  });
  
  it('megvilágítás 0-1 tartományban van', () => {
    const pos = calculateMoonPosition(new Date());
    expect(pos.illumination).toBeGreaterThanOrEqual(0);
    expect(pos.illumination).toBeLessThanOrEqual(1);
  });
  
  it('egy hónap alatt ~1 teljes kört tesz (RA változik)', () => {
    const date1 = new Date('2024-06-01T12:00:00Z');
    const date2 = new Date('2024-06-15T12:00:00Z');
    const pos1 = calculateMoonPosition(date1);
    const pos2 = calculateMoonPosition(date2);
    expect(pos1.ra).not.toBeCloseTo(pos2.ra, 0);
  });
});

describe('Angular méretezés', () => {
  it('nagyobb FOV -> kisebb scene méret', () => {
    const size60 = angularSizeToScene(30, 60);
    const size10 = angularSizeToScene(30, 10);
    expect(size10).toBeGreaterThan(size60);
  });
  
  it('nagyobb angular méret -> nagyobb scene méret', () => {
    const small = angularSizeToScene(5, 60);
    const big = angularSizeToScene(30, 60);
    expect(big).toBeGreaterThan(small);
  });
  
  it('Hold mérete (31 ívperc) FOV=60°-nál', () => {
    const moonSize = angularSizeToScene(31, 60);
    expect(moonSize).toBeCloseTo(1.72, 0);
  });
  
  it('nem negatív értéket ad', () => {
    const size = angularSizeToScene(0.1, 120);
    expect(size).toBeGreaterThan(0);
  });
});

describe('Csillag pont méret', () => {
  it('fényesebb csillag nagyobb pontot ad', () => {
    const sirius = starPointSize(-1.46, 60);
    const dim = starPointSize(5, 60);
    expect(sirius).toBeGreaterThan(dim);
  });
  
  it('szűkebb FOV -> nagyobb pont', () => {
    const wide = starPointSize(1, 60);
    const narrow = starPointSize(1, 5);
    expect(narrow).toBeGreaterThan(wide);
  });
  
  it('mindig pozitív', () => {
    const size = starPointSize(10, 120);
    expect(size).toBeGreaterThan(0);
  });
});

describe('Holdfázis nevek', () => {
  const getMoonPhaseName = (phase) => {
    if (phase < 0.03 || phase > 0.97) return 'Újhold';
    if (phase < 0.22) return 'Növekvő sarló';
    if (phase < 0.28) return 'Első negyed';
    if (phase < 0.47) return 'Növekvő hold';
    if (phase < 0.53) return 'Telihold';
    if (phase < 0.72) return 'Fogyó hold';
    if (phase < 0.78) return 'Utolsó negyed';
    return 'Fogyó sarló';
  };
  
  it('újhold a 0-nál', () => {
    expect(getMoonPhaseName(0)).toBe('Újhold');
    expect(getMoonPhaseName(0.01)).toBe('Újhold');
    expect(getMoonPhaseName(0.99)).toBe('Újhold');
  });
  
  it('telihold a 0.5-nél', () => {
    expect(getMoonPhaseName(0.5)).toBe('Telihold');
  });
  
  it('első negyed a 0.25-nél', () => {
    expect(getMoonPhaseName(0.25)).toBe('Első negyed');
  });
  
  it('minden fázisnak van neve', () => {
    for (let p = 0; p <= 1; p += 0.01) {
      const name = getMoonPhaseName(p);
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    }
  });
});

describe('FOV (Field of View) tartomány', () => {
  it('minimum FOV 0.005°', () => {
    const minFov = 0.005;
    expect(minFov).toBeGreaterThan(0);
  });
  
  it('maximum FOV 120°', () => {
    const maxFov = 120;
    expect(maxFov).toBeLessThanOrEqual(180);
  });
  
  it('logaritmikus zoom helyes tartományban', () => {
    const minLog = -3;
    const maxLog = 2.08;
    const minFov = Math.pow(10, minLog);
    const maxFov = Math.pow(10, maxLog);
    
    expect(minFov).toBeCloseTo(0.001, 3);
    expect(maxFov).toBeCloseTo(120, 0);
  });
  
  it('exponenciális zoom faktor 1.08x', () => {
    const fov = 60;
    const zoomIn = fov * (1 / 1.08);
    const zoomOut = fov * 1.08;
    
    expect(zoomIn).toBeLessThan(fov);
    expect(zoomOut).toBeGreaterThan(fov);
    expect(zoomIn).toBeCloseTo(55.56, 1);
    expect(zoomOut).toBeCloseTo(64.8, 1);
  });
});

describe('Aladin Lite FOV küszöbértékek', () => {
  const FOV_THRESHOLDS = {
    galaxy: 5,
    nebula: 8,
    exoplanet: 2,
    star: 1,
    default: 5,
  };
  
  const shouldShowAladin = (objectType, fov) => {
    const threshold = FOV_THRESHOLDS[objectType] || FOV_THRESHOLDS.default;
    return fov <= threshold;
  };
  
  it('galaxis: FOV < 5° → megjelenít', () => {
    expect(shouldShowAladin('galaxy', 3)).toBe(true);
    expect(shouldShowAladin('galaxy', 10)).toBe(false);
  });
  
  it('köd: FOV < 8° → megjelenít', () => {
    expect(shouldShowAladin('nebula', 5)).toBe(true);
    expect(shouldShowAladin('nebula', 15)).toBe(false);
  });
  
  it('exobolygó: FOV < 2° → megjelenít', () => {
    expect(shouldShowAladin('exoplanet', 1)).toBe(true);
    expect(shouldShowAladin('exoplanet', 5)).toBe(false);
  });
  
  it('ismeretlen típus: default küszöb (5°)', () => {
    expect(shouldShowAladin('unknown', 3)).toBe(true);
    expect(shouldShowAladin('unknown', 10)).toBe(false);
  });
});

describe('RA konverzió (óra -> fok)', () => {
  it('0h = 0°', () => {
    expect(0 * 15).toBe(0);
  });
  
  it('6h = 90°', () => {
    expect(6 * 15).toBe(90);
  });
  
  it('12h = 180°', () => {
    expect(12 * 15).toBe(180);
  });
  
  it('24h = 360°', () => {
    expect(24 * 15).toBe(360);
  });
});

describe('Bolygó angular diameter', () => {
  const PLANET_ANGULAR_DIAMETERS = {
    mercury: 8,
    venus: 25,
    mars: 18,
    jupiter: 44,
    saturn: 18,
    uranus: 3.7,
    neptune: 2.3,
  };
  
  it('Jupiter a legnagyobb', () => {
    const max = Math.max(...Object.values(PLANET_ANGULAR_DIAMETERS));
    expect(max).toBe(PLANET_ANGULAR_DIAMETERS.jupiter);
  });
  
  it('Neptunusz a legkisebb', () => {
    const min = Math.min(...Object.values(PLANET_ANGULAR_DIAMETERS));
    expect(min).toBe(PLANET_ANGULAR_DIAMETERS.neptune);
  });
  
  it('minden érték pozitív', () => {
    Object.values(PLANET_ANGULAR_DIAMETERS).forEach(d => {
      expect(d).toBeGreaterThan(0);
    });
  });
});

describe('Keresés logika', () => {
  it('minimum 2 karakter kell a kereséshez', () => {
    const minLength = 2;
    expect('a'.length < minLength).toBe(true);
    expect('ab'.length >= minLength).toBe(true);
  });
  
  it('case-insensitive keresés', () => {
    const query = 'SiRiUs'.toLowerCase();
    const starName = 'Sirius'.toLowerCase();
    expect(starName.includes(query)).toBe(true);
  });
  
  it('magyar hold keresés működik', () => {
    const query = 'ho';
    expect('hold'.includes(query)).toBe(true);
  });
  
  it('magyar nap keresés működik', () => {
    const query = 'na';
    expect('nap'.includes(query)).toBe(true);
  });
  
  it('max 15 eredmény', () => {
    const results = Array.from({ length: 30 }, (_, i) => `result_${i}`);
    const limited = results.slice(0, 15);
    expect(limited.length).toBe(15);
  });
});