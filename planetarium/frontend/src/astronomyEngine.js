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

export const calculatePlanetPosition = (planet, date) => {
  const pos = calculatePlanetPositionPrecise(planet, date);
  if (!pos) return null;
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