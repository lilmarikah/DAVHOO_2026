import { CELESTIAL_SPHERE_RADIUS } from './constants';

/**
 * RA/Dec → 3D vektor (x, y, z)
 *
 * @param {number} ra     - rektaszcenzió órában (0-24)
 * @param {number} dec    - deklináció fokban (-90..+90)
 * @param {number} radius - sugár scene-egységekben
 * @returns {{x: number, y: number, z: number}}
 */
export const raDecTo3D = (ra, dec, radius = CELESTIAL_SPHERE_RADIUS) => {
  const raRad = (ra * 15 * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  return {
    x: radius * Math.cos(decRad) * Math.cos(raRad),
    y: radius * Math.sin(decRad),
    z: -radius * Math.cos(decRad) * Math.sin(raRad),
  };
};

/**
 * RA/Dec → Three.js Spherical(phi, theta) kamera célponthoz
 *
 * @param {number} ra  - órában (0-24)
 * @param {number} dec - fokban
 * @returns {{phi: number, theta: number}}
 */
export const raDecToSpherical = (ra, dec) => {
  const raRad = (ra * 15 * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  const x = Math.cos(decRad) * Math.cos(raRad);
  const y = Math.sin(decRad);
  const z = -Math.cos(decRad) * Math.sin(raRad);

  const phi = Math.acos(Math.max(-1, Math.min(1, y)));
  const theta = Math.atan2(x, z);

  return { phi, theta };
};

export const getStarColorByMagnitude = (mag) => {
  if (mag < -0.5) return '#9bb0ff';
  if (mag < 0.5) return '#aabfff';
  if (mag < 1.5) return '#cad7ff';
  if (mag < 2.5) return '#f8f7ff';
  if (mag < 3.5) return '#fff4ea';
  if (mag < 4.5) return '#ffd2a1';
  return '#ffcc6f';
};
