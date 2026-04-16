import { CELESTIAL_SPHERE_RADIUS } from './constants';

/**
 * Ívperc → 3D scene egység az aktuális FOV alapján
 *
 * @param {number} arcminutes  - objektum angular mérete ívpercben
 * @param {number} fov         - aktuális FOV fokban
 * @returns {number}           - méret scene-egységekben
 */
export const angularSizeToScene = (arcminutes, fov) => {
  const angularDeg = arcminutes / 60;
  const fraction = angularDeg / fov;
  return fraction * CELESTIAL_SPHERE_RADIUS * 2;
};

/**
 * Csillag pont-méret fényesség alapján
 *
 * A csillagok angular mérete elhanyagolható (<0.001"),
 * így Stellarium-stílusban a fényesség határozza meg a pontméretet.
 *
 * @param {number} mag - vizuális magnitúdó
 * @param {number} fov - aktuális FOV fokban
 * @returns {number}   - pont méret scene-egységekben
 */
export const starPointSize = (mag, fov) => {
  const baseMag = Math.max(0.08, 0.7 - mag * 0.1);
  const fovFactor = Math.pow(75 / Math.max(fov, 0.01), 0.3);
  return baseMag * fovFactor;
};

export const magnitudeLimit = (fov) => {
  return 6 + Math.log10(Math.max(fov, 0.01)) * 2;
};

export const PLANET_ANGULAR_DIAMETERS = {
  mercury: 8,
  venus: 25,
  mars: 18,
  jupiter: 44,
  saturn: 18,
  uranus: 3.7,
  neptune: 2.3,
};

export const SUN_ANGULAR_DIAMETER_ARCMIN = 32;
export const MOON_ANGULAR_DIAMETER_ARCMIN = 31;

export const fovDescription = (fov) => {
  if (fov > 60) return '🌐 Szabad szem';
  if (fov > 10) return '👁️ Normál';
  if (fov > 1) return '🔭 Távcső';
  if (fov > 0.1) return '🔬 Nagy távcső';
  return '🛰️ Űrtávcső';
};

export const formatFov = (fov) => {
  if (fov >= 1) return `${fov.toFixed(1)}°`;
  if (fov >= 1 / 60) return `${(fov * 60).toFixed(1)}'`;
  return `${(fov * 3600).toFixed(0)}"`;
};