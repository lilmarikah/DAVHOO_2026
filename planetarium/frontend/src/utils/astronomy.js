export const dateToJulianDate = (date) => {
  return date.getTime() / 86400000 + 2440587.5;
};

export const julianDateToGMST = (jd) => {
  const t = (jd - 2451545.0) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  return gmst / 15;
};

export const calculateLST = (date, longitude) => {
  const jd = dateToJulianDate(date);
  const gmst = julianDateToGMST(jd);
  return (gmst + longitude / 15 + 24) % 24;
};

const daysSinceJ2000 = (date) => {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  return (date.getTime() - J2000.getTime()) / (1000 * 60 * 60 * 24);
};

const DEG = Math.PI / 180;

export const calculatePlanetPosition = (planet, date) => {
  const d = daysSinceJ2000(date);

  const M =
    ((360 / planet.orbitalPeriod) * d +
      planet.meanLongitude -
      planet.longitudeOfPerihelion) %
    360;
  const M_rad = M * DEG;

  let E = M_rad;
  for (let i = 0; i < 5; i++) {
    E = M_rad + planet.eccentricity * Math.sin(E);
  }

  const v =
    2 *
    Math.atan2(
      Math.sqrt(1 + planet.eccentricity) * Math.sin(E / 2),
      Math.sqrt(1 - planet.eccentricity) * Math.cos(E / 2)
    );

  const omega = planet.longitudeOfPerihelion * DEG;
  const longitude = ((v + omega) * 180) / Math.PI;
  const eclipticObliquity = 23.44 * DEG;
  const lambda = longitude * DEG;

  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eclipticObliquity),
    Math.cos(lambda)
  );
  const dec = Math.asin(Math.sin(eclipticObliquity) * Math.sin(lambda) * 0.1);

  return {
    ra: (((ra * 180) / Math.PI / 15) + 24) % 24,
    dec: (dec * 180) / Math.PI,
  };
};

export const calculateSunPosition = (date) => {
  const d = daysSinceJ2000(date);

  const L = (280.46 + 0.9856474 * d) % 360;
  const g = (357.528 + 0.9856003 * d) % 360;
  const gRad = g * DEG;

  const lambda = L + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad);
  const lambdaRad = lambda * DEG;

  const epsilon = 23.439 - 0.0000004 * d;
  const epsilonRad = epsilon * DEG;

  const ra = Math.atan2(
    Math.cos(epsilonRad) * Math.sin(lambdaRad),
    Math.cos(lambdaRad)
  );
  const dec = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad));

  return {
    ra: (((ra * 180) / Math.PI / 15) + 24) % 24,
    dec: (dec * 180) / Math.PI,
  };
};

export const calculateMoonPosition = (date) => {
  const d = daysSinceJ2000(date);

  const L = (218.316 + 13.176396 * d) % 360;
  const M = (134.963 + 13.064993 * d) % 360;
  const F = (93.272 + 13.22935 * d) % 360;

  const longitude = L + 6.289 * Math.sin(M * DEG);
  const latitude = 5.128 * Math.sin(F * DEG);

  const lambda = longitude * DEG;
  const beta = latitude * DEG;
  const obliquity = 23.44 * DEG;

  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(obliquity) -
      Math.tan(beta) * Math.sin(obliquity),
    Math.cos(lambda)
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(obliquity) +
      Math.cos(beta) * Math.sin(obliquity) * Math.sin(lambda)
  );

  const sunLong = (280.46 + 0.9856474 * d) % 360;
  const phase = ((longitude - sunLong + 360) % 360) / 360;

  return {
    ra: (((ra * 180) / Math.PI / 15) + 24) % 24,
    dec: (dec * 180) / Math.PI,
    phase,
    illumination: (1 - Math.cos(phase * 2 * Math.PI)) / 2,
  };
};

export const getMoonPhaseName = (phase) => {
  if (phase < 0.025 || phase >= 0.975) return 'Újhold 🌑';
  if (phase < 0.225) return 'Növekvő sarló 🌒';
  if (phase < 0.275) return 'Első negyed 🌓';
  if (phase < 0.475) return 'Növekvő hold 🌔';
  if (phase < 0.525) return 'Telihold 🌕';
  if (phase < 0.725) return 'Fogyó hold 🌖';
  if (phase < 0.775) return 'Utolsó negyed 🌗';
  return 'Fogyó sarló 🌘';
};