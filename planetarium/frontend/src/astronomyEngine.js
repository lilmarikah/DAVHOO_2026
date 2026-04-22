import * as Astronomy from 'astronomy-engine';

const PLANET_BODY_MAP = {
  'mercury': Astronomy.Body.Mercury,
  'venus': Astronomy.Body.Venus,
  'mars': Astronomy.Body.Mars,
  'jupiter': Astronomy.Body.Jupiter,
  'saturn': Astronomy.Body.Saturn,
  'uranus': Astronomy.Body.Uranus,
  'neptune': Astronomy.Body.Neptune,
};

const dateToAstroTime = (date) => {
  return Astronomy.MakeTime(date);
};

export const jdToDate = (jd) => {
  return new Date((jd - 2440587.5) * 86400000);
};

export const dateToJulianDate = (date) => {
  return date.getTime() / 86400000 + 2440587.5;
};

export const calculatePlanetPositionPrecise = (planet, date) => {
  const body = PLANET_BODY_MAP[planet.id];
  if (!body) {

    console.warn(`Ismeretlen bolygó ID: ${planet.id}`);
    return null;
  }
  
  const time = dateToAstroTime(date);
  
  const defaultObserver = new Astronomy.Observer(0, 0, 0);
  const equ = Astronomy.Equator(body, time, defaultObserver, true, true);
  
  const elongation = Astronomy.AngleFromSun(body, time);
  
  return {
    ra: equ.ra,
    dec: equ.dec,
    distance: equ.dist,
    elongation: elongation
  };
};

export const calculateSunPositionPrecise = (date) => {
  const time = dateToAstroTime(date);
  
  const defaultObserver = new Astronomy.Observer(0, 0, 0);
  const equ = Astronomy.Equator(Astronomy.Body.Sun, time, defaultObserver, true, true);
  
  const sunEcl = Astronomy.SunPosition(time);
  
  return {
    ra: equ.ra,
    dec: equ.dec,
    distance: equ.dist,
    eclipticLongitude: sunEcl.elon
  };
};

export const calculateMoonPositionPrecise = (date) => {
  const time = dateToAstroTime(date);
  
  const defaultObserver = new Astronomy.Observer(0, 0, 0);
  const equ = Astronomy.Equator(Astronomy.Body.Moon, time, defaultObserver, true, true);
  
  const phaseAngle = Astronomy.MoonPhase(time);
  
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, time);
  
  const phase = phaseAngle / 360;
  
  const distance_km = equ.dist * Astronomy.KM_PER_AU;
  
  return {
    ra: equ.ra,
    dec: equ.dec,
    phase: phase,
    illumination: illum.phase_fraction,
    phaseAngle: phaseAngle,
    distance_km: distance_km
  };
};

export const getMoonPhaseName = (phase) => {
  if (phase < 0.03 || phase > 0.97) return 'Újhold';
  if (phase < 0.22) return 'Növekvő sarló';
  if (phase < 0.28) return 'Első negyed';
  if (phase < 0.47) return 'Növekvő hold';
  if (phase < 0.53) return 'Telihold';
  if (phase < 0.72) return 'Fogyó hold';
  if (phase < 0.78) return 'Utolsó negyed';
  return 'Fogyó sarló';
};

export const calculateLSTPrecise = (date, longitude) => {
  const time = dateToAstroTime(date);
  
  const gmst = Astronomy.SiderealTime(time);
  
  let lst = (gmst + longitude / 15) % 24;
  if (lst < 0) lst += 24;
  
  return lst;
};

export const julianDateToGMST = (jd) => {
  const date = jdToDate(jd);
  const time = dateToAstroTime(date);
  return Astronomy.SiderealTime(time);
};

export const raDecToAltAz = (ra, dec, date, latitude, longitude) => {
  const time = dateToAstroTime(date);
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  
  const hor = Astronomy.Horizon(time, observer, ra, dec, 'normal');
  
  return {
    altitude: hor.altitude,
    azimuth: hor.azimuth
  };
};

export const getRiseSet = (planetId, date, latitude, longitude) => {
  const body = PLANET_BODY_MAP[planetId] || Astronomy.Body.Sun;
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const time = dateToAstroTime(date);
  
  try {
    const rise = Astronomy.SearchRiseSet(body, observer, +1, time, 1);
    const set = Astronomy.SearchRiseSet(body, observer, -1, time, 1);
    
    return {
      rise: rise ? rise.date : null,
      set: set ? set.date : null
    };
  } catch (e) {
    return { rise: null, set: null };
  }
};

export const getDeltaT = (date) => {
  const jd = dateToJulianDate(date);
  const ut = jd - 2451545.0;
  return Astronomy.DeltaT_EspenakMeeus(ut / 365.25 + 2000.0);
};

export const calculateAllPlanetPositions = (planets, date) => {
  const positions = new Map();
  
  for (const planet of planets) {
    const pos = calculatePlanetPositionPrecise(planet, date);
    if (pos) {
      positions.set(planet.id, pos);
    }
  }
  
  return positions;
};

export const calculatePlanetPosition = (planet, date) => {
  const pos = calculatePlanetPositionPrecise(planet, date);
  if (!pos) {
    return calculatePlanetPositionFallback(planet, date);
  }
  return { ra: pos.ra, dec: pos.dec };
};

export const calculateSunPosition = (date) => {
  const pos = calculateSunPositionPrecise(date);
  return { ra: pos.ra, dec: pos.dec };
};

export const calculateMoonPosition = (date) => {
  const pos = calculateMoonPositionPrecise(date);
  return {
    ra: pos.ra,
    dec: pos.dec,
    phase: pos.phase,
    illumination: pos.illumination
  };
};

export const calculateLST = (date, longitude) => {
  return calculateLSTPrecise(date, longitude);
};

const calculatePlanetPositionFallback = (planet, date) => {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const daysSinceJ2000 = (date.getTime() - J2000.getTime()) / (1000 * 60 * 60 * 24);
  
  const M = ((360 / planet.orbitalPeriod) * daysSinceJ2000 + planet.meanLongitude - planet.longitudeOfPerihelion) % 360;
  const M_rad = (M * Math.PI) / 180;
  
  let E = M_rad;
  for (let i = 0; i < 5; i++) {
    E = M_rad + planet.eccentricity * Math.sin(E);
  }
  
  const v = 2 * Math.atan2(
    Math.sqrt(1 + planet.eccentricity) * Math.sin(E / 2),
    Math.sqrt(1 - planet.eccentricity) * Math.cos(E / 2)
  );
  
  const omega = (planet.longitudeOfPerihelion * Math.PI) / 180;
  const longitude = ((v + omega) * 180 / Math.PI + 360) % 360;
  
  const eclipticObliquity = 23.44 * Math.PI / 180;
  const lambda = longitude * Math.PI / 180;
  
  const ra = Math.atan2(Math.sin(lambda) * Math.cos(eclipticObliquity), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eclipticObliquity) * Math.sin(lambda) * 0.1);
  
  return {
    ra: ((ra * 180 / Math.PI / 15) + 24) % 24,
    dec: dec * 180 / Math.PI
  };
};

export const JD_SECOND = 1 / 86400;
export const JD_MINUTE = 1 / 1440;
export const JD_HOUR = 1 / 24;
export const JD_DAY = 1.0;
export const J2000_JD = 2451545.0;
export const Body = Astronomy.Body;