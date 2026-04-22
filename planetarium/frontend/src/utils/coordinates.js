import { CELESTIAL_SPHERE_RADIUS } from './constants';

export const raDecTo3D = (ra, dec, radius = CELESTIAL_SPHERE_RADIUS) => {
  const raRad = (ra * 15 * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  return {
    x: radius * Math.cos(decRad) * Math.cos(raRad),
    y: radius * Math.sin(decRad),
    z: -radius * Math.cos(decRad) * Math.sin(raRad),
  };
};

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