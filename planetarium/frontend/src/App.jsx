import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import NASADashboard from './NASADashboard';
import './NASADashboard.css';
import AladinInlineViewer from './AladinViewer';
import Nebula3D from './NebulaComponents';
import usePlanetariumDB from './usePlanetariumDB';
import { brightStars as cdStars, constellationData as cdConstellations } from './celestialData';
import {
  calculatePlanetPosition,
  calculateSunPosition,
  calculateMoonPosition,
  calculateLST,
  dateToJulianDate,
  getMoonPhaseName,

  calculatePlanetPositionPrecise,
  calculateSunPositionPrecise,
  calculateMoonPositionPrecise,
  raDecToAltAz,
  getRiseSet
} from './astronomyEngine';

const CELESTIAL_SPHERE_RADIUS = 100;

const raDecTo3D = (ra, dec, radius = CELESTIAL_SPHERE_RADIUS) => {
  const raRad = (ra * 15) * Math.PI / 180;
  const decRad = dec * Math.PI / 180;

  const x = radius * Math.cos(decRad) * Math.cos(raRad);
  const y = radius * Math.sin(decRad);
  const z = -radius * Math.cos(decRad) * Math.sin(raRad);

  return new THREE.Vector3(x, y, z);
};

const raDecToSpherical = (ra, dec) => {
  const raRad = (ra * 15) * Math.PI / 180;
  const decRad = dec * Math.PI / 180;

  const targetX = Math.cos(decRad) * Math.cos(raRad);
  const targetY = Math.sin(decRad);
  const targetZ = -Math.cos(decRad) * Math.sin(raRad);

  const phi = Math.acos(Math.max(-1, Math.min(1, targetY)));
  const theta = Math.atan2(targetX, targetZ);

  return { phi, theta };
};

const angularSizeToScene = (arcminutes, fov) => {

  const angularDeg = arcminutes / 60;

  const fraction = angularDeg / fov;

  return fraction * CELESTIAL_SPHERE_RADIUS * 2;
};

const starPointSize = (mag, fov) => {

  const baseMag = Math.max(0.08, 0.7 - mag * 0.1);

  const fovFactor = Math.pow(75 / Math.max(fov, 0.01), 0.3);
  return baseMag * fovFactor;
};

const PLANET_ANGULAR_DIAMETERS = {
  mercury: 8,
  venus: 25,
  mars: 18,
  jupiter: 44,
  saturn: 18,
  uranus: 3.7,
  neptune: 2.3,
};

const SUN_ANGULAR_DIAMETER_ARCMIN = 32;
const MOON_ANGULAR_DIAMETER_ARCMIN = 31;
const TEXTURE_PATHS = {
  sun: '/textures/Nap.jpg',
  mercury: '/textures/Merkur.jpg',
  venus: '/textures/Venusz.jpg',
  earth: '/textures/8k_earth_daymap.jpg',
  mars: '/textures/Mars.jpg',
  jupiter: '/textures/Jupiter.jpg',
  saturn: '/textures/Szaturnusz.jpg',
  saturnRing: '/textures/Szaturnusz_gyuru.png',
  uranus: '/textures/Uranusz.jpg',
  neptune: '/textures/Neptunusz.jpg',
  moon: '/textures/Hold.jpg'
};

const getStarColorByMagnitude = (mag) => {
  if (mag < -0.5) return '#9bb0ff';
  if (mag < 0.5) return '#aabfff';
  if (mag < 1.5) return '#cad7ff';
  if (mag < 2.5) return '#f8f7ff';
  if (mag < 3.5) return '#fff4ea';
  if (mag < 4.5) return '#ffd2a1';
  return '#ffcc6f';
};

function StereographicControls({ latitude, lst, fov, setFov, focusTarget, onFocusComplete }) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const spherical = useRef(new THREE.Spherical(1, Math.PI / 2, 0));
  const isAnimating = useRef(false);
  const targetSpherical = useRef(null);
  const pinchDistance = useRef(0);

  useEffect(() => {
    spherical.current.phi = Math.PI / 2;
    spherical.current.theta = Math.PI;
  }, []);

  useEffect(() => {
    if (focusTarget && focusTarget.phi !== undefined && focusTarget.theta !== undefined) {
      targetSpherical.current = { phi: focusTarget.phi, theta: focusTarget.theta };
      isAnimating.current = true;
    }
  }, [focusTarget]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e) => {
      if (e.target.closest('header') || e.clientY < 64) return;
      isDragging.current = true;
      isAnimating.current = false;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      const rotateSpeed = 0.003 * (fov / 60);

      spherical.current.theta -= deltaX * rotateSpeed;
      spherical.current.phi += deltaY * rotateSpeed;
      spherical.current.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.current.phi));

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleWheel = (e) => {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
      const newFov = fov * zoomFactor;

      setFov(Math.max(15, Math.min(100, newFov)));
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        isAnimating.current = false;
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {

        isDragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging.current) {
        const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.current.y;
        const rotateSpeed = 0.003 * (fov / 60);

        spherical.current.theta -= deltaX * rotateSpeed;
        spherical.current.phi += deltaY * rotateSpeed;
        spherical.current.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.current.phi));

        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        if (pinchDistance.current > 0) {
          const scale = pinchDistance.current / newDist;
          const newFov = fov * scale;
          setFov(Math.max(15, Math.min(100, newFov)));
        }
        pinchDistance.current = newDist;
      }
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      pinchDistance.current = 0;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl, fov, setFov]);

  useFrame(() => {

    if (isAnimating.current && targetSpherical.current) {
      const speed = 0.08;
      const target = targetSpherical.current;

      const phiDiff = target.phi - spherical.current.phi;
      spherical.current.phi += phiDiff * speed;

      let thetaDiff = target.theta - spherical.current.theta;
      if (thetaDiff > Math.PI) thetaDiff -= 2 * Math.PI;
      if (thetaDiff < -Math.PI) thetaDiff += 2 * Math.PI;
      spherical.current.theta += thetaDiff * speed;

      if (Math.abs(phiDiff) < 0.001 && Math.abs(thetaDiff) < 0.001) {
        isAnimating.current = false;
        targetSpherical.current = null;
        if (onFocusComplete) onFocusComplete();
      }
    }

    camera.position.set(0, 0, 0);
    const target = new THREE.Vector3();
    target.setFromSpherical(spherical.current);
    camera.lookAt(target);
    camera.fov = fov;
    camera.near = 0.001;
    camera.far = 2000;
    camera.updateProjectionMatrix();
  });

  return null;
}

const STAR_VERT = `
  attribute float a_mag;
  attribute vec3 a_color;
  varying vec3 v_color;
  varying float v_mag;
  uniform float u_fov;
  uniform float u_time;

  void main() {
    v_color = a_color;
    v_mag = a_mag;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float baseMag = max(0.5, 4.5 - a_mag * 0.6);
    float fovFactor = pow(75.0 / max(u_fov, 1.0), 0.3);
    float size = baseMag * fovFactor;

    if (a_mag < 2.0) {
      size *= 1.0 + sin(u_time * 2.0 + a_mag * 100.0) * 0.15;
    }

    gl_PointSize = size * (300.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 20.0);
  }
`;

const STAR_FRAG = `
  varying vec3 v_color;
  varying float v_mag;

  void main() {

    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    float glow = v_mag < 1.5 ? (1.5 - v_mag) * 0.3 : 0.0;
    alpha += glow * (1.0 - smoothstep(0.2, 0.5, dist));

    gl_FragColor = vec4(v_color, alpha);
  }
`;

function StarsField({ stars, showLabels, onStarClick, selectedObject, fov }) {
  const pointsRef = useRef();
  const matRef = useRef();

  const { positions, colors, mags } = useMemo(() => {
    const pos = new Float32Array(stars.length * 3);
    const col = new Float32Array(stars.length * 3);
    const mag = new Float32Array(stars.length);

    for (let i = 0; i < stars.length; i++) {
      const p = raDecTo3D(stars[i].ra, stars[i].dec, CELESTIAL_SPHERE_RADIUS);
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;

      const c = new THREE.Color(stars[i].color || getStarColorByMagnitude(stars[i].mag));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      mag[i] = stars[i].mag;
    }
    return { positions: pos, colors: col, mags: mag };
  }, [stars]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      u_fov: { value: fov },
      u_time: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame(({ clock }) => {
    if (material.uniforms) {
      material.uniforms.u_fov.value = fov;
      material.uniforms.u_time.value = clock.elapsedTime;
    }
  });

  const getStarLabel = useCallback((s) => {
    return s.name || s.proper_name || s.bayer || s.flamsteed || null;
  }, []);

  const labelStars = useMemo(() => {
    return stars.filter(s => {
      const label = getStarLabel(s);
      if (!label) return false;

      if (s.name && s.mag < 2.5) return true;

      if ((s.bayer || s.constellation) && s.mag < 3.5) return true;

      if (fov < 30 && s.mag < 4.5 && (s.bayer || s.name)) return true;
      if (fov < 20 && s.mag < 5.5 && (s.bayer || s.name)) return true;

      return false;
    }).slice(0, 150);
  }, [stars, fov, getStarLabel]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!pointsRef.current) return;

    const idx = e.index;
    if (idx !== undefined && idx < stars.length) {
      onStarClick(stars[idx]);
    }
  }, [stars, onStarClick]);

  return (
    <>
      <points ref={pointsRef} frustumCulled={false} onClick={handleClick}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={stars.length} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-a_color" count={stars.length} array={colors} itemSize={3} />
          <bufferAttribute attach="attributes-a_mag" count={stars.length} array={mags} itemSize={1} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>

      {}
      {showLabels && labelStars.map(star => {
        const pos = raDecTo3D(star.ra, star.dec, CELESTIAL_SPHERE_RADIUS);
        const starColor = star.color || getStarColorByMagnitude(star.mag);
        const sz = starPointSize(star.mag, fov);
        const label = getStarLabel(star);
        return (
          <Html
            key={`lbl-${star.id}`}
            zIndexRange={[1, 0]}
            position={[pos.x + sz * 2.5, pos.y + sz * 1.5, pos.z]}
            style={{
              color: star.name ? starColor : '#88aacc',
              fontSize: `${Math.min(13, star.name ? 10 + (75 - fov) / 15 : 8 + (75 - fov) / 20)}px`,
              fontFamily: 'Exo 2, sans-serif',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              textShadow: `0 0 6px ${star.name ? starColor : '#446688'}`,
              opacity: star.name ? 1 : 0.7,
            }}
          >
            {label}
          </Html>
        );
      })}

      {}
      {selectedObject?.type === 'star' && selectedObject.ra !== undefined && (() => {
        const pos = raDecTo3D(selectedObject.ra, selectedObject.dec, CELESTIAL_SPHERE_RADIUS);
        const sz = starPointSize(selectedObject.mag || 1, fov);
        return (
          <mesh position={pos} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[sz * 2.5, sz * 3, 16]} />
            <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        );
      })()}
    </>
  );
}

const PLANET_MAT = {
  mercury:  { emissiveHex: '#554433', emissiveI: 0.3, shininess: 10 },
  venus:    { emissiveHex: '#665533', emissiveI: 0.35, shininess: 5  },
  earth:    { emissiveHex: '#223355', emissiveI: 0.3, shininess: 25 },
  mars:     { emissiveHex: '#553311', emissiveI: 0.3, shininess: 10 },
  jupiter:  { emissiveHex: '#443322', emissiveI: 0.3, shininess: 15 },
  saturn:   { emissiveHex: '#554422', emissiveI: 0.3, shininess: 10 },
  uranus:   { emissiveHex: '#336666', emissiveI: 0.25, shininess: 20 },
  neptune:  { emissiveHex: '#223366', emissiveI: 0.25, shininess: 20 },
};

function Planet3D({ planet, date, showLabels, onClick, isSelected, fov = 60 }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);

  const { position, planetRaDec } = useMemo(() => {
    const pos = calculatePlanetPosition(planet, date);
    return {
      position: raDecTo3D(pos.ra, pos.dec, CELESTIAL_SPHERE_RADIUS * 0.98),
      planetRaDec: pos,
    };
  }, [planet, date]);

  const angularDiamArcsec = PLANET_ANGULAR_DIAMETERS[planet.id] || 10;
  const angularDiamArcmin = angularDiamArcsec / 60;
  const realSize = angularSizeToScene(angularDiamArcmin, fov);

  const minPointSize = starPointSize(planet.mag || 0, fov);
  const scaledSize = Math.max(minPointSize, realSize);

  const showAsDisc = realSize > minPointSize * 1.5;

  const mat = PLANET_MAT[planet.id] || { emissiveHex: '#111111', emissiveI: 0.15, shininess: 15 };

  useEffect(() => {
    const texturePath = TEXTURE_PATHS[planet.id];
    if (!texturePath) return;

    const loader = new THREE.TextureLoader();
    loader.load(texturePath, (loadedTexture) => {
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      setTexture(loadedTexture);
    }, undefined, () => {});
  }, [planet.id]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group position={position}>
      {}
      {(planet.id === 'earth' || planet.id === 'venus') && (
        <mesh>
          <sphereGeometry args={[scaledSize * 1.1, 32, 32]} />
          <meshBasicMaterial
            color={planet.id === 'earth' ? '#4488ff' : '#ffaa00'}
            transparent
            opacity={planet.id === 'earth' ? 0.08 : 0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick({ ...planet, ra: planetRaDec.ra, dec: planetRaDec.dec }); }}
      >
        <sphereGeometry args={[scaledSize, 32, 32]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={planet.color} />
        )}
      </mesh>

      {planet.id === 'saturn' && <SaturnRing size={scaledSize} />}

      {planet.id === 'uranus' && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <ringGeometry args={[scaledSize * 1.3, scaledSize * 1.6, 64]} />
          <meshBasicMaterial color="#88ccdd" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {showLabels && (
        <Html zIndexRange={[1, 0]}
          position={[scaledSize * 2, scaledSize * 1.2, 0]}
          style={{
            color: planet.color,
            fontSize: `${12 + (60 - fov) / 8}px`,
            fontWeight: 'bold',
            fontFamily: 'Exo 2, sans-serif',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: `0 0 10px ${planet.color}`,
          }}
        >
          {planet.name}
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[scaledSize * 1.8, scaledSize * 2.3, 32]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function SaturnRing({ size }) {
  const [ringTexture, setRingTexture] = useState(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(TEXTURE_PATHS.saturnRing, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      setRingTexture(texture);
    });
  }, []);

  return (
    <mesh rotation={[Math.PI / 2.5, 0, 0]}>
      <ringGeometry args={[size * 1.3, size * 2.2, 64]} />
      {ringTexture ? (
        <meshBasicMaterial map={ringTexture} transparent side={THREE.DoubleSide} />
      ) : (
        <meshBasicMaterial color="#d4a574" transparent opacity={0.6} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

function Moon3D({ date, showLabels, onClick, isSelected, fov = 60, moonData }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);

  const moonPos = useMemo(() => calculateMoonPosition(date), [date]);
  const position = useMemo(() => raDecTo3D(moonPos.ra, moonPos.dec, CELESTIAL_SPHERE_RADIUS * 0.95), [moonPos]);

  const scaledSize = Math.max(0.3, angularSizeToScene(MOON_ANGULAR_DIAMETER_ARCMIN, fov));

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(TEXTURE_PATHS.moon, (loadedTexture) => {
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      setTexture(loadedTexture);
    });
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group position={position}>
      {}
      <mesh>
        <sphereGeometry args={[scaledSize * 1.4, 24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>

      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick({ ...moonData, ra: moonPos.ra, dec: moonPos.dec, phase: moonPos.phase, illumination: moonPos.illumination }); }}
      >
        <sphereGeometry args={[scaledSize, 32, 32]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={moonData.color} />
        )}
      </mesh>

      {showLabels && (
        <Html zIndexRange={[1, 0]}
          position={[scaledSize * 2, scaledSize * 1.2, 0]}
          style={{
            color: '#D4D4D4',
            fontSize: `${12 + (60 - fov) / 8}px`,
            fontWeight: 'bold',
            fontFamily: 'Exo 2, sans-serif',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
          }}
        >
          Hold
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[scaledSize * 1.8, scaledSize * 2.3, 32]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

const SUN_VERTEX = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAGMENT = `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.7, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0; float a = 0.7; vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; ++i) { v += a * snoise(p); p = p * 2.0 + shift; a *= 0.7; }
    return v;
  }

  void main() {
    vec3 pos = vPosition * 1.5 + time * 0.1;
    float n1 = fbm(pos) * 0.7 + 0.7;
    float n2 = fbm(pos + vec3(10.0)) * 0.7 + 0.7;
    float baseNoise = clamp(n1 * 0.6 + n2 * 0.4, 0.0, 1.0);

    float detail = snoise(pos * 5.0 + vec3(20.0)) * 0.5 + 0.5;
    baseNoise += detail * 0.1;
    baseNoise = clamp(baseNoise, 0.0, 1.0);

    float glowFactor = pow(max(dot(vNormal, normalize(cameraPosition - vPosition)), 0.0), 2.0);
    vec3 radiantGlow = vec3(1.0, 0.8, 0.0) * glowFactor * 0.3;

    vec3 yellow = vec3(1.0, 1.0, 0.1);
    vec3 orange = vec3(1.0, 0.6, 0.2);
    vec3 red = vec3(1.0, 0.0, 0.2);

    vec3 color = mix(yellow, orange, baseNoise);
    color = mix(color, red, detail * 0.2);
    color += radiantGlow;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const SUN_ATMO_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_ATMO_FRAGMENT = `
  uniform vec3 glowColor;
  uniform float glowIntensity;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
    rim = pow(rim, 0.1);
    float intensity = rim * glowIntensity;
    gl_FragColor = vec4(glowColor, intensity);
  }
`;

function Sun3D({ date, showLabels, onClick, isSelected, fov = 60, sunData }) {
  const meshRef = useRef();
  const coronaRef = useRef();

  const sunPos = useMemo(() => calculateSunPosition(date), [date]);
  const position = useMemo(() => raDecTo3D(sunPos.ra, sunPos.dec, CELESTIAL_SPHERE_RADIUS * 0.97), [sunPos]);

  const scaledSize = Math.max(0.4, angularSizeToScene(SUN_ANGULAR_DIAMETER_ARCMIN, fov));

  const sunMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SUN_VERTEX,
    fragmentShader: SUN_FRAGMENT,
    uniforms: { time: { value: 0 } },
  }), []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0004;
    }
    sunMaterial.uniforms.time.value = clock.elapsedTime;
    if (coronaRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.05;
      coronaRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[scaledSize * 1.6, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.04} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>

      {}
      <mesh>
        <sphereGeometry args={[scaledSize * 1.15, 32, 32]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.06} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>

      {}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick({ ...sunData, ra: sunPos.ra, dec: sunPos.dec }); }}
      >
        <sphereGeometry args={[scaledSize, 64, 64]} />
        <primitive object={sunMaterial} attach="material" />
      </mesh>

      <pointLight color="#fff5e0" intensity={2.5} distance={200} decay={1} />

      {showLabels && (
        <Html zIndexRange={[1, 0]}
          position={[scaledSize * 2, scaledSize * 1.5, 0]}
          style={{
            color: '#FFDD44',
            fontSize: `${14 + (60 - fov) / 6}px`,
            fontWeight: 'bold',
            fontFamily: 'Orbitron, sans-serif',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: '0 0 12px #FFAA00',
          }}
        >
          Nap
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[scaledSize * 2, scaledSize * 2.5, 32]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

const GALAXY_STYLES = {
  purple_blue:    { mode: 0, palette: [[0.6,0.4,1],[0.4,0.6,1],[0.7,0.5,0.95],[0.5,0.7,1]], intensity: 1.6, spirals: 3, turns: 1.0 },
  single_orange:  { mode: 2, color: [1,0.65,0.3], intensity: 1.5, spirals: 3, turns: 1.0 },
  nebula:         { mode: 0, palette: [[0.9,0.5,0.7],[0.5,0.7,1],[0.95,0.85,0.6],[0.6,0.9,0.8]], intensity: 1.7, spirals: 4, turns: 0.5 },
  single_green:   { mode: 2, color: [0.2,0.9,0.5], intensity: 1.4, spirals: 3, turns: 1.0 },
  blue_giant:     { mode: 0, palette: [[0.5,0.7,1],[0.6,0.8,1],[0.7,0.85,1],[0.9,0.95,1]], intensity: 1.6, spirals: 3, turns: 1.2 },
  radial_gradient:{ mode: 1, palette: [[1,0.95,0.7],[0.9,0.85,0.9],[0.5,0.6,1],[0.4,0.5,0.9]], intensity: 1.5, spirals: 3, turns: 1.0 },
  classic_mixed:  { mode: 0, palette: [[0.96,0.87,0.7],[0.68,0.85,0.9],[0.95,0.75,0.95],[0.7,0.95,0.85]], intensity: 1.4, spirals: 3, turns: 1.0 },
};

const GAL_VERT = `
uniform vec2 u_resolution;
uniform float u_pointSize;
uniform float u_totalPoints;
uniform float u_time;
attribute float a_index;
varying float v_index;
varying float v_radius;

uniform float u_blackHoleRadius;
uniform float u_spiralCount;
uniform float u_turnsPerSpiral;

float rand2(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453) * 2.0 - 1.0; }
vec3 noise3(float i){ return vec3(rand2(vec2(i,i+0.1)), rand2(vec2(i+1.0,i+1.1)), rand2(vec2(i+2.0,i+2.1))); }
float rand01(float i){ return rand2(vec2(i,i+5.0)) * 0.5 + 0.5; }

void main(){
  v_index = a_index;
  float pps = floor(u_totalPoints / u_spiralCount);
  float si = floor(a_index / pps);
  float ao = si / u_spiralCount * 6.28318;
  float idx = mod(a_index, pps);

  float tOff = mod(u_time, 1.0);
  idx = mod(idx - tOff * pps, pps);

  float r = idx / pps;
  v_radius = r;
  float a = r * 6.28318 * u_turnsPerSpiral + ao;

  vec3 n = noise3(a_index) * 0.4;
  r *= (1.0 + n.x * 0.5);
  a += n.y * 0.1745;
  float pa = n.z * 0.0873;

  float x = cos(a) * r;
  float y = sin(a) * r;
  float z = sin(pa) * r;
  vec3 rnd = noise3(a_index + 22.2) * 0.02;
  vec3 pos = vec3(x+rnd.x, y+rnd.y, z+rnd.z);

  float d = length(pos);
  if(d < u_blackHoleRadius && d > 0.001){
    pos = pos * (u_blackHoleRadius / d);
  }

  vec4 vp = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * vp;
  float dist = -vp.z;

  float ps = 4.0 * pow(rand01(a_index+7.0)+0.1, 3.0) * pow(rand01(a_index+9.0)+0.1, 3.0);
  gl_PointSize = u_pointSize * ps * (u_resolution.y/1200.0) / max(dist, 0.01);
}`;

const GAL_FRAG = `
uniform vec3 u_color;
uniform int u_colorMode;
uniform vec3 u_palette[4];
uniform int u_paletteSize;
uniform float u_colorIntensity;
varying float v_index;
varying float v_radius;

void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  if(dot(p,p) > 1.0) discard;

  vec3 c = u_color;
  if(u_colorMode == 0){
    int ci = int(floor(v_index)) % max(1, u_paletteSize);
    if(ci==0) c = u_palette[0];
    else if(ci==1) c = u_palette[1];
    else if(ci==2) c = u_palette[2];
    else c = u_palette[3];
  } else if(u_colorMode == 1){
    float t = clamp(v_radius, 0.0, 1.0);
    int bi = int(floor(t * float(u_paletteSize-1)));
    int ni = min(bi+1, u_paletteSize-1);
    float bl = fract(t * float(u_paletteSize-1));
    c = mix(u_palette[min(bi,3)], u_palette[min(ni,3)], bl);
  }

  c *= u_colorIntensity;
  float soft = 1.0 - smoothstep(0.5, 1.0, length(p));
  gl_FragColor = vec4(c, soft);
}`;

function Exoplanet3D({ exoplanet, showLabels, onClick, isSelected, fov = 60 }) {
  const meshRef = useRef();
  const position = useMemo(() => {
    if (!exoplanet.ra || !exoplanet.dec) return [0, 0, 0];
    return raDecTo3D(exoplanet.ra / 15, exoplanet.dec, CELESTIAL_SPHERE_RADIUS * 0.95);
  }, [exoplanet.ra, exoplanet.dec]);

  const color = exoplanet.isHabitableZone ? '#44ff88' : '#ffaa44';

  const size = starPointSize(exoplanet.stellarMagnitude || 12, fov) * 0.8;

  if (fov > 30) return null;

  return (
    <group position={position}>
      {}
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick && onClick(exoplanet); }}>
        <sphereGeometry args={[size * 0.12, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {}
      <sprite scale={[size * 0.5, size * 0.5, 1]}>
        <spriteMaterial color={color} transparent opacity={isSelected ? 0.7 : 0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {showLabels && fov < 10 && (
        <Html zIndexRange={[1, 0]} position={[0, size * 0.4, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ color, fontSize: '9px', textShadow: `0 0 4px ${color}`, whiteSpace: 'nowrap', fontFamily: 'Orbitron, monospace', opacity: 0.85 }}>
            {exoplanet.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function Galaxy3D({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const matRef = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const angularArcmin = galaxy.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const fixedBaseSize = Math.max(0.2, realSize);
  const gType = galaxy.type || 'spiral';
  const style = GALAXY_STYLES[galaxy.shaderStyle] || GALAXY_STYLES.classic_mixed;

  const totalStars = gType === 'elliptical' ? 6000 : gType === 'irregular' ? 5000 : 10000;
  const spirals = gType === 'elliptical' ? 8 : gType === 'irregular' ? 5 : (style.spirals || 3);
  const turns = gType === 'elliptical' ? 0.2 : gType === 'irregular' ? 0.4 : (style.turns || 1.0);
  const bhRadius = gType === 'elliptical' ? 0.03 : 0.1;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(totalStars * 3);
    const idx = new Float32Array(totalStars);
    for (let i = 0; i < totalStars; i++) idx[i] = i;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('a_index', new THREE.BufferAttribute(idx, 1));
    return geo;
  }, [totalStars]);

  const paletteVecs = useMemo(() => {
    const p = style.palette || [[1,1,1],[1,1,1],[1,1,1],[1,1,1]];
    const vecs = [];
    for (let i = 0; i < 4; i++) {
      const c = p[i] || p[0];
      vecs.push(new THREE.Vector3(c[0], c[1], c[2]));
    }
    return vecs;
  }, [style]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_color: { value: new THREE.Color(style.color ? style.color[0] : 1, style.color ? style.color[1] : 1, style.color ? style.color[2] : 1) },
        u_pointSize: { value: 4.0 },
        u_totalPoints: { value: totalStars },
        u_time: { value: 0 },
        u_blackHoleRadius: { value: bhRadius },
        u_spiralCount: { value: spirals },
        u_turnsPerSpiral: { value: turns },
        u_colorMode: { value: style.mode },
        u_palette: { value: paletteVecs },
        u_paletteSize: { value: paletteVecs.length },
        u_colorIntensity: { value: style.intensity || 1.0 },
      },
      vertexShader: GAL_VERT,
      fragmentShader: GAL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [totalStars, spirals, turns, bhRadius, style, paletteVecs]);

  const glowColor = useMemo(() => {
    const c = (style.palette || [[0.5,0.5,1]])[0];
    return `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`;
  }, [style]);

  useFrame(({ camera, clock }) => {
    if (billboardRef.current) {
      const parentWorldQuat = new THREE.Quaternion(); billboardRef.current.parent.getWorldQuaternion(parentWorldQuat); billboardRef.current.quaternion.copy(parentWorldQuat.invert().multiply(camera.quaternion));
    }
    material.uniforms.u_time.value = clock.elapsedTime * 0.015;
  });

  const s = fixedBaseSize;

  return (
    <group position={position} scale={[s, s, s]}>
      <group ref={billboardRef}>
        <points geometry={geometry} material={material} frustumCulled={false} />
      </group>

      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[1.2, 0.6, 0]} style={{
          color: glowColor, fontSize: `${10 + (60-fov)/10}px`,
          fontFamily: 'Exo 2, sans-serif', pointerEvents: 'auto', cursor: 'pointer',
          whiteSpace: 'nowrap', textShadow: `0 0 8px ${glowColor}`,
        }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function SkyBackground() {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/textures/Hatter.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      setTexture(tex);
    }, undefined, () => {

      loader.load('/textures/8k_stars_milky_way.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      }, undefined, () => {});
    });
  }, []);

  if (!texture) return null;

  return (
    <mesh>
      <sphereGeometry args={[280, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

const mcVertex = `
  uniform vec3 uCameraLocalPos;
  varying vec3 vOrigin;
  varying vec3 vDirection;

  void main() {
    vOrigin    = uCameraLocalPos;
    vDirection = position - uCameraLocalPos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mcFragment = `
  precision highp float;
  varying vec3 vOrigin;
  varying vec3 vDirection;

  uniform float uTime;
  uniform float uSeed;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform float uAlphaScale;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
          mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
          mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<4;i++){v+=a*noise3(p);p*=2.1;a*=0.5;}
    return v;
  }

  vec2 hitBox(vec3 orig, vec3 dir) {
    vec3 inv = 1.0 / dir;
    vec3 t0  = (-0.5 - orig) * inv;
    vec3 t1  = ( 0.5 - orig) * inv;
    vec3 tmi = min(t0,t1), tma = max(t0,t1);
    return vec2(max(max(tmi.x,tmi.y),tmi.z),
                min(min(tma.x,tma.y),tma.z));
  }

  float getDensity(vec3 p) {

    float r = length(p) * 2.0;         
    float envelope = smoothstep(1.0, 0.15, r);
    if (envelope <= 0.0) return 0.0;

    vec3 seed3 = vec3(uSeed*0.37, uSeed*0.19, uSeed*0.53);
    vec3 q  = p * 5.5 + seed3 + vec3(uTime*0.012, uTime*0.008, uTime*0.005);
    vec3 q2 = p * 3.2 + seed3 * 1.7 + vec3(uTime*0.006, uTime*-0.004, 0.0);

    float n1 = fbm(q);
    float n2 = fbm(q2);
    float density = (n1 * 0.60 + n2 * 0.40 - 0.10) * envelope;
    return max(0.0, density);
  }

  void main() {
    vec3 rd = normalize(vDirection);
    vec2 bounds = hitBox(vOrigin, rd);
    if (bounds.x >= bounds.y) discard;
    bounds.x = max(bounds.x, 0.0);

    float rayLen  = bounds.y - bounds.x;
    const int STEPS = 28;
    float stepSz  = rayLen / float(STEPS);

    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.545);
    vec3 p = vOrigin + (bounds.x + jitter * stepSz) * rd;

    vec3  accColor = vec3(0.0);
    float transmit = 1.0;

    for (int i = 0; i < STEPS; i++) {
      float dens = getDensity(p);
      if (dens > 0.005) {
        float r = length(p) * 2.0;

        vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 0.45, r));
        col       = mix(col,    uColor3, smoothstep(0.45, 0.9, r));

        col += vec3(0.04, 0.02, 0.0) * smoothstep(0.4, 0.0, r);

        float absorb = exp(-dens * stepSz * 8.0);
        accColor += transmit * col * dens * stepSz * 4.5;
        transmit *= absorb;
        if (transmit < 0.02) break;
      }
      p += rd * stepSz;
    }

    float alpha = (1.0 - transmit) * uAlphaScale;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(accColor, alpha);
  }
`;

const MC_CONFIGS = {
  LMC: {

    color1: new THREE.Color('#3e3830'),  
    color2: new THREE.Color('#22263a'),  
    color3: new THREE.Color('#07080f'),  
    scaleX: 1.18, scaleY: 0.58, scaleZ: 0.72,
    alphaScale: 0.62,
    glowColor: '#88998a',
    seed: 1.31,
  },
  SMC: {
    color1: new THREE.Color('#2e333e'),  
    color2: new THREE.Color('#1a2030'),  
    color3: new THREE.Color('#05060d'),  
    scaleX: 1.08, scaleY: 0.82, scaleZ: 0.75,
    alphaScale: 0.55,
    glowColor: '#667788',
    seed: 4.73,
  },
};

function MagellanicCloud({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const meshRef  = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const s   = Math.max(0.3, angularSizeToScene(galaxy.size_arcmin || 10, fov));
  const cfg = MC_CONFIGS[galaxy.id] || MC_CONFIGS.LMC;

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   mcVertex,
    fragmentShader: mcFragment,
    uniforms: {
      uCameraLocalPos: { value: new THREE.Vector3(0, 0, -96) },
      uTime:           { value: 0 },
      uSeed:           { value: cfg.seed },
      uColor1:         { value: cfg.color1 },
      uColor2:         { value: cfg.color2 },
      uColor3:         { value: cfg.color3 },
      uAlphaScale:     { value: cfg.alphaScale },
    },
    side:       THREE.FrontSide,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.NormalBlending,
  }), [galaxy.id]);

  const _mat = useRef(new THREE.Matrix4());
  const _cam = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    if (meshRef.current) {
      _mat.current.copy(meshRef.current.matrixWorld).invert();
      _cam.current.copy(camera.position).applyMatrix4(_mat.current);
      material.uniforms.uCameraLocalPos.value.copy(_cam.current);
    }
  });

  const { scaleX, scaleY, scaleZ, glowColor } = cfg;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        material={material}
        scale={[s * scaleX, s * scaleY, s * scaleZ]}
        onClick={(e) => { e.stopPropagation(); onClick && onClick(galaxy); }}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[s * scaleX * 0.65, s * scaleY * 0.65, 0]} style={{
          color: glowColor,
          fontSize: `${10 + (60 - fov) / 10}px`,
          fontFamily: 'Exo 2, sans-serif',
          pointerEvents: 'auto',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textShadow: `0 0 6px ${glowColor}`,
        }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[s * scaleX * 1.1, s * scaleX * 1.25, 48]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function CigarGalaxy({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const rotRef = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const angularArcmin = galaxy.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const fixedBaseSize = Math.max(0.2, realSize);

  const { positions: cloudPos, colors: cloudCol } = useMemo(() => {
    const pos = [];
    const col = [];

    const noise3D = (x, y, z) => {
      return (Math.sin(x*2.1+y*3.7)*Math.cos(z*4.3+x*1.2) + Math.sin(y*3.3+z*2.5)*Math.cos(x*3.8)) / 2;
    };
    const fbm = (x, y, z) => {
      let v = 0, a = 0.5;
      for (let i = 0; i < 3; i++) { v += a * noise3D(x, y, z); x *= 2; y *= 2; z *= 2; a *= 0.5; }
      return v;
    };

    for (let i = 0; i < 6000; i++) {
      const t = (Math.random() - 0.5) * 2;
      const width = 0.08 * (1 - Math.abs(t) * 0.7);
      const rx = t * 0.7;
      const ry = (Math.random() - 0.5) * width;
      const rz = (Math.random() - 0.5) * width * 0.8;

      const turb = fbm(rx * 4, ry * 8, rz * 8) * 0.02;

      pos.push(rx + turb, ry + turb * 0.5, rz + turb * 0.3);

      const dist = Math.abs(t);
      const centerDist = Math.sqrt(ry*ry + rz*rz) / width;

      if (centerDist < 0.3 && dist < 0.3) {

        const b = 0.9 + Math.random() * 0.3;
        col.push(1.0 * b, 0.8 * b, 0.4 * b);
      } else if (dist < 0.5) {

        const b = 0.7 + Math.random() * 0.3;
        col.push(0.95 * b, 0.9 * b, 0.75 * b);
      } else {

        const b = 0.4 + Math.random() * 0.3;
        col.push(0.8 * b, 0.85 * b, 1.0 * b);
      }
    }

    for (let i = 0; i < 5000; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;

      const h = Math.pow(Math.random(), 0.7) * 0.6;

      const spread = 0.05 + h * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5) * spread;

      let rx = Math.cos(angle) * r * 0.4;
      let ry = side * h;
      let rz = Math.sin(angle) * r;

      rx += (Math.random() - 0.5) * 0.15;

      const turb = fbm(rx * 3, ry * 2, rz * 3);
      rx += turb * 0.08;
      ry += turb * 0.05 * side;
      rz += turb * 0.08;

      pos.push(rx, ry, rz);

      const distFromCenter = Math.sqrt(rx*rx + rz*rz);
      const heightFade = 1 - h / 0.6;
      const intensity = heightFade * (0.5 + Math.random() * 0.5);

      if (distFromCenter < 0.08 && h < 0.15) {

        col.push(1.0 * intensity, 0.6 * intensity, 0.3 * intensity);
      } else if (Math.random() < 0.6) {

        col.push(0.9 * intensity, 0.25 * intensity, 0.2 * intensity);
      } else {

        col.push(0.85 * intensity, 0.35 * intensity, 0.45 * intensity);
      }
    }

    for (let i = 0; i < 1500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.15 + Math.random() * 0.4;

      pos.push(
        r * Math.sin(phi) * Math.cos(theta) * 1.5,
        r * Math.sin(phi) * Math.sin(theta) * 0.8,
        r * Math.cos(phi) * 0.8
      );

      const b = 0.15 + Math.random() * 0.1;
      col.push(0.8 * b, 0.3 * b, 0.35 * b);
    }

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col)
    };
  }, []);

  const glowColor = '#ff6644';

  useFrame(({ camera, clock }) => {
    if (rotRef.current) rotRef.current.rotation.z = clock.elapsedTime * 0.02;
    if (billboardRef.current) {
      const parentWorldQuat = new THREE.Quaternion(); billboardRef.current.parent.getWorldQuaternion(parentWorldQuat); billboardRef.current.quaternion.copy(parentWorldQuat.invert().multiply(camera.quaternion));
    }
  });

  const s = fixedBaseSize;

  return (
    <group position={position} scale={[s, s, s]}>
      <group ref={billboardRef}>
        <group ref={rotRef}>
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={cloudPos.length / 3} array={cloudPos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={cloudCol.length / 3} array={cloudCol} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.025}
            vertexColors
            transparent
            opacity={0.85}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
        </group>
      </group>

      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[1.2, 0.6, 0]} style={{
          color: glowColor, fontSize: `${10 + (60-fov)/10}px`,
          fontFamily: 'Exo 2, sans-serif', pointerEvents: 'auto', cursor: 'pointer',
          whiteSpace: 'nowrap', textShadow: `0 0 8px ${glowColor}`,
        }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function CentaurusAGalaxy({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const rotRef = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const angularArcmin = galaxy.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const fixedBaseSize = Math.max(0.2, realSize);

  const { positions: cloudPos, colors: cloudCol } = useMemo(() => {
    const pos = [];
    const col = [];

    const fbm = (x, y, z) => {
      let v = 0, a = 0.5;
      for (let i = 0; i < 3; i++) {
        v += a * (Math.sin(x*2.1+y*3.7)*Math.cos(z*4.3+x*1.2) + Math.sin(y*3.3+z*2.5)*Math.cos(x*3.8)) / 2;
        x *= 2.2; y *= 2.2; z *= 2.2; a *= 0.5;
      }
      return v;
    };

    for (let i = 0; i < 5000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 1.5) * 0.45;

      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.sin(phi) * Math.sin(theta) * 0.75;
      let z = r * Math.cos(phi) * 0.75;

      pos.push(x, y, z);

      const d = r / 0.45;
      if (d < 0.2) {
        const b = 1.0 + Math.random() * 0.2;
        col.push(1.0 * b, 0.95 * b, 0.85 * b);
      } else if (d < 0.5) {
        const b = 0.7 + Math.random() * 0.3;
        col.push(1.0 * b, 0.88 * b, 0.7 * b);
      } else {
        const b = 0.3 + Math.random() * 0.2;
        col.push(0.95 * b, 0.8 * b, 0.6 * b);
      }
    }

    for (let i = 0; i < 3000; i++) {
      const t = (Math.random() - 0.5) * 2;
      const dustAngle = 0.5;
      const width = 0.1 * (1 - Math.abs(t) * 0.3);
      const perpOffset = (Math.random() - 0.5) * width;

      let x = t * 0.5 * Math.cos(dustAngle) - perpOffset * Math.sin(dustAngle);
      let y = t * 0.5 * Math.sin(dustAngle) + perpOffset * Math.cos(dustAngle);
      let z = (Math.random() - 0.5) * 0.02;

      const turb = fbm(x * 5, y * 5, z * 10);
      x += turb * 0.025;
      y += turb * 0.02;

      pos.push(x, y, z);

      const edgeDist = Math.abs(perpOffset) / width;
      if (edgeDist > 0.65) {
        const b = 0.5 + Math.random() * 0.3;
        col.push(0.9 * b, 0.4 * b, 0.25 * b);
      } else {
        const b = 0.03 + Math.random() * 0.07;
        col.push(0.3 * b, 0.15 * b, 0.1 * b);
      }
    }

    for (let i = 0; i < 5000; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const jetAngle = 0.5 + Math.PI / 2;

      const h = Math.pow(Math.random(), 0.6) * 0.75;

      const bubbleWidth = 0.08 + 0.35 * Math.sin(h / 0.75 * Math.PI * 0.85);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5) * bubbleWidth;

      let lx = Math.cos(angle) * r * 0.5;
      let ly = side * h;
      let lz = Math.sin(angle) * r * 0.5;

      let x = lx * Math.cos(jetAngle - Math.PI/2) - ly * Math.sin(jetAngle - Math.PI/2);
      let y = lx * Math.sin(jetAngle - Math.PI/2) + ly * Math.cos(jetAngle - Math.PI/2);
      let z = lz;

      const turb = fbm(x * 2.5, y * 2.5, z * 2.5);
      x += turb * 0.08;
      y += turb * 0.08;
      z += turb * 0.06;

      pos.push(x, y, z);

      const lobDist = h / 0.75;
      const radDist = r / bubbleWidth;

      if (lobDist < 0.15 && radDist < 0.3) {

        const b = 0.8 + Math.random() * 0.3;
        col.push(1.0 * b, 0.4 * b, 0.7 * b);
      } else if (radDist > 0.7) {

        const b = 0.15 + Math.random() * 0.15;
        col.push(0.9 * b, 0.35 * b, 0.65 * b);
      } else if (Math.random() < 0.3) {

        const b = 0.3 + Math.random() * 0.3;
        col.push(0.7 * b, 0.2 * b, 0.9 * b);
      } else {

        const b = 0.25 + Math.random() * 0.35;
        col.push(1.0 * b, 0.35 * b, 0.55 * b);
      }
    }

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col)
    };
  }, []);

  const glowColor = '#ff66aa';

  useFrame(({ camera, clock }) => {
    if (rotRef.current) rotRef.current.rotation.z = clock.elapsedTime * 0.015;
    if (billboardRef.current) {
      const parentWorldQuat = new THREE.Quaternion(); billboardRef.current.parent.getWorldQuaternion(parentWorldQuat); billboardRef.current.quaternion.copy(parentWorldQuat.invert().multiply(camera.quaternion));
    }
  });

  const s = fixedBaseSize;

  return (
    <group position={position} scale={[s, s, s]}>
      <group ref={billboardRef}>
        <group ref={rotRef}>
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={cloudPos.length / 3} array={cloudPos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={cloudCol.length / 3} array={cloudCol} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.025}
            vertexColors
            transparent
            opacity={0.85}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
        </group>
      </group>

      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[1.2, 0.6, 0]} style={{
          color: glowColor, fontSize: `${10 + (60-fov)/10}px`,
          fontFamily: 'Exo 2, sans-serif', pointerEvents: 'auto', cursor: 'pointer',
          whiteSpace: 'nowrap', textShadow: `0 0 8px ${glowColor}`,
        }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function PinwheelGalaxy({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const rotRef = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const angularArcmin = galaxy.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const fixedBaseSize = Math.max(0.2, realSize);

  const { positions: cloudPos, colors: cloudCol } = useMemo(() => {
    const pos = [];
    const col = [];

    const fbm = (x, y, z) => {
      let v = 0, a = 0.5;
      for (let i = 0; i < 3; i++) {
        v += a * (Math.sin(x*2.1+y*3.7)*Math.cos(z*4.3+x*1.2) + Math.sin(y*3.3+z*2.5)*Math.cos(x*3.8)) / 2;
        x *= 2.2; y *= 2.2; z *= 2.2; a *= 0.5;
      }
      return v;
    };

    const spiralCount = 5;
    const turns = 1.8;

    for (let i = 0; i < 7000; i++) {
      const armIdx = i % spiralCount;
      const armOffset = (armIdx / spiralCount) * Math.PI * 2;
      const t = Math.pow(Math.random(), 0.6);

      let r = t * 0.75;
      let angle = t * Math.PI * 2 * turns + armOffset;

      const spread = (0.02 + t * 0.08);
      const nx = (Math.sin(i * 12.9 + 78.2) * 43758.5 % 1 - 0.5) * spread;
      const ny = (Math.sin(i * 23.4 + 91.1) * 43758.5 % 1 - 0.5) * spread;
      angle += (Math.sin(i * 34.7 + 12.4) * 43758.5 % 1 - 0.5) * 0.3;

      let x = Math.cos(angle) * r + nx;
      let y = Math.sin(angle) * r + ny;
      let z = (Math.sin(i * 45.6 + 33.7) * 43758.5 % 1 - 0.5) * 0.015 * r;

      pos.push(x, y, z);

      const rnd = Math.random();
      if (t < 0.15) {

        const b = 0.9 + Math.random() * 0.3;
        col.push(1.0 * b, 0.92 * b, 0.7 * b);
      } else if (t < 0.3) {

        const b = 0.6 + Math.random() * 0.3;
        if (rnd < 0.3) col.push(1.0 * b, 0.75 * b, 0.35 * b);
        else col.push(0.95 * b, 0.9 * b, 0.6 * b);
      } else if (rnd < 0.2) {

        const b = 0.7 + Math.random() * 0.5;
        col.push(1.0 * b, 0.4 * b, 0.7 * b);
      } else if (rnd < 0.35) {

        const b = 0.3 + Math.random() * 0.3;
        col.push(0.85 * b, 0.25 * b, 0.2 * b);
      } else if (rnd < 0.55) {

        const b = 0.5 + Math.random() * 0.3;
        col.push(0.95 * b, 0.9 * b, 0.8 * b);
      } else {

        const b = 0.3 + Math.random() * 0.3;
        col.push(0.5 * b, 0.8 * b, 0.9 * b);
      }
    }

    for (let i = 0; i < 4000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.pow(Math.random(), 0.5) * 0.6;

      let x = Math.cos(theta) * r;
      let y = Math.sin(theta) * r;
      let z = (Math.random() - 0.5) * 0.03;

      const turb = fbm(x * 3, y * 3, z * 5);
      x += turb * 0.06;
      y += turb * 0.06;

      pos.push(x, y, z);

      const b = 0.08 + Math.random() * 0.12;
      const rnd = Math.random();
      if (rnd < 0.5) {
        col.push(0.3 * b, 0.7 * b, 0.85 * b);
      } else if (rnd < 0.8) {
        col.push(0.4 * b, 0.75 * b, 0.6 * b);
      } else {
        col.push(0.6 * b, 0.65 * b, 0.9 * b);
      }
    }

    for (let i = 0; i < 500; i++) {
      const armIdx = Math.floor(Math.random() * spiralCount);
      const armOffset = (armIdx / spiralCount) * Math.PI * 2;
      const t = 0.25 + Math.random() * 0.55;

      let r = t * 0.75;
      let angle = t * Math.PI * 2 * turns + armOffset;
      angle += (Math.random() - 0.5) * 0.15;

      let x = Math.cos(angle) * r + (Math.random() - 0.5) * 0.02;
      let y = Math.sin(angle) * r + (Math.random() - 0.5) * 0.02;
      let z = (Math.random() - 0.5) * 0.005;

      pos.push(x, y, z);

      const b = 1.0 + Math.random() * 0.5;
      if (Math.random() < 0.7) {
        col.push(1.0 * b, 0.35 * b, 0.65 * b);
      } else {
        col.push(0.9 * b, 0.3 * b, 0.9 * b);
      }
    }

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col)
    };
  }, []);

  const glowColor = '#88ccff';

  useFrame(({ camera, clock }) => {
    if (rotRef.current) rotRef.current.rotation.z = clock.elapsedTime * 0.04;
    if (billboardRef.current) {
      const parentWorldQuat = new THREE.Quaternion(); billboardRef.current.parent.getWorldQuaternion(parentWorldQuat); billboardRef.current.quaternion.copy(parentWorldQuat.invert().multiply(camera.quaternion));
    }
  });

  const s = fixedBaseSize;

  return (
    <group position={position} scale={[s, s, s]}>
      <group ref={billboardRef}>
        <group ref={rotRef}>
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={cloudPos.length / 3} array={cloudPos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={cloudCol.length / 3} array={cloudCol} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.018}
            vertexColors
            transparent
            opacity={0.9}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
        </group>
      </group>

      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[1.2, 0.6, 0]} style={{
          color: glowColor, fontSize: `${10 + (60-fov)/10}px`,
          fontFamily: 'Exo 2, sans-serif', pointerEvents: 'auto', cursor: 'pointer',
          whiteSpace: 'nowrap', textShadow: `0 0 8px ${glowColor}`,
        }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}

      {isSelected && (
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function _fbm(x, y, z) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 3; i++) {
    v += a * (Math.sin(x*2.1+y*3.7)*Math.cos(z*4.3+x*1.2) + Math.sin(y*3.3+z*2.5)*Math.cos(x*3.8)) / 2;
    x *= 2.2; y *= 2.2; z *= 2.2; a *= 0.5;
  }
  return v;
}

function genSombrero() {
  const pos = [], col = [];

  for (let i = 0; i < 6000; i++) {
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    const r = Math.pow(Math.random(),1.8)*0.4;
    pos.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th)*0.6, r*Math.cos(ph)*0.6);
    const d = r/0.4, b = 0.7+(1-d)*0.6+Math.random()*0.2;
    if(d<0.15) col.push(1*b,0.97*b,0.9*b);
    else if(d<0.4) col.push(1*b,0.93*b,0.75*b);
    else col.push(0.9*b*0.5,0.8*b*0.5,0.6*b*0.5);
  }

  for (let i = 0; i < 4000; i++) {
    const t = (Math.random()-0.5)*2, w = 0.025*(1-Math.abs(t)*0.3);
    const x = t*0.8, y = (Math.random()-0.5)*w, z = (Math.random()-0.5)*w*0.5;
    pos.push(x,y,z);
    const b = 0.3+Math.random()*0.2;
    if(Math.abs(y)<w*0.3) col.push(0.3*b,0.15*b,0.08*b);
    else col.push(0.8*b,0.75*b,0.9*b);
  }

  for (let i = 0; i < 2000; i++) {
    const th = Math.random()*Math.PI*2, r = 0.3+Math.random()*0.5;
    pos.push(r*Math.cos(th), (Math.random()-0.5)*0.08, r*Math.sin(th)*0.3);
    const b = 0.08+Math.random()*0.08;
    col.push(0.7*b,0.65*b,0.85*b);
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genVirgoA() {
  const pos = [], col = [];
  for (let i = 0; i < 10000; i++) {
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    const r = Math.pow(Math.random(),1.6)*0.7;
    pos.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th)*0.85, r*Math.cos(ph)*0.85);
    const d = r/0.7, b = 0.4+(1-d)*0.7+Math.random()*0.15;
    if(d<0.1) col.push(1*b,0.95*b,0.85*b);
    else if(d<0.3) col.push(1*b,0.88*b,0.65*b);
    else if(d<0.6) col.push(0.9*b,0.75*b,0.5*b);
    else col.push(0.7*b*0.4,0.55*b*0.4,0.35*b*0.4);
  }

  for (let i = 0; i < 800; i++) {
    const side = Math.random()<0.5?1:-1;
    const h = Math.random()*0.6;
    pos.push((Math.random()-0.5)*0.03, side*h, (Math.random()-0.5)*0.02);
    const b = 0.15+Math.random()*0.15;
    col.push(0.5*b,0.6*b,1*b);
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genSculptor() {
  const pos = [], col = [];

  for (let i = 0; i < 8000; i++) {
    const arm = i%2, ao = arm*Math.PI;
    const t = Math.pow(Math.random(),0.6);
    let r = t*0.7, a = t*Math.PI*2*1.5+ao;
    const sp = 0.03+t*0.06;
    const nx = (Math.sin(i*12.9+78.2)*43758.5%1-0.5)*sp;
    const ny = (Math.sin(i*23.4+91.1)*43758.5%1-0.5)*sp;
    a += (Math.sin(i*34.7+12.4)*43758.5%1-0.5)*0.25;
    let x = Math.cos(a)*r+nx, y = (Math.random()-0.5)*0.02*r, z = Math.sin(a)*r*0.35+ny;
    pos.push(x,y,z);
    const rnd = Math.random();
    if(t<0.15){const b=0.8+Math.random()*0.4;col.push(1*b,0.82*b,0.5*b);}
    else if(rnd<0.12){const b=0.6+Math.random()*0.5;col.push(1*b,0.4*b,0.55*b);}
    else if(rnd<0.35){const b=0.3+Math.random()*0.3;col.push(0.6*b,0.55*b,0.9*b);}
    else if(rnd<0.55){const b=0.3+Math.random()*0.3;col.push(0.5*b,0.7*b,0.95*b);}
    else{const b=0.2+Math.random()*0.2;col.push(0.85*b,0.75*b,0.6*b);}
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genBode() {
  const pos = [], col = [];

  for (let i = 0; i < 3000; i++) {
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    const r = Math.pow(Math.random(),2)*0.25;
    pos.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th)*0.6, r*Math.cos(ph)*0.6);
    const b = 0.8+(1-r/0.25)*0.5+Math.random()*0.2;
    col.push(1*b,0.92*b,0.7*b);
  }

  for (let i = 0; i < 7000; i++) {
    const arm = i%2, ao = arm*Math.PI;
    const t = Math.pow(Math.random(),0.5);
    let r = 0.1+t*0.6, a = t*Math.PI*2*1.2+ao;
    const sp = 0.02+t*0.05;
    const nx = (Math.sin(i*12.9+78.2)*43758.5%1-0.5)*sp;
    a += (Math.sin(i*34.7+12.4)*43758.5%1-0.5)*0.2;
    let x = Math.cos(a)*r+nx, y = (Math.random()-0.5)*0.015, z = Math.sin(a)*r*0.5;
    pos.push(x,y,z);
    const rnd = Math.random();
    if(rnd<0.1){const b=0.5+Math.random()*0.4;col.push(1*b,0.4*b,0.5*b);}
    else if(rnd<0.15){const b=0.2+Math.random()*0.15;col.push(0.6*b,0.35*b,0.2*b);}
    else if(rnd<0.5){const b=0.3+Math.random()*0.35;col.push(0.5*b,0.6*b,0.95*b);}
    else{const b=0.2+Math.random()*0.25;col.push(0.7*b,0.7*b,0.85*b);}
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genWhirlpool() {
  const pos = [], col = [];

  for (let i = 0; i < 2000; i++) {
    const th = Math.random()*Math.PI*2, r = Math.pow(Math.random(),2)*0.15;
    pos.push(r*Math.cos(th), (Math.random()-0.5)*0.01, r*Math.sin(th));
    const b = 0.8+Math.random()*0.4;
    col.push(1*b,0.92*b,0.7*b);
  }

  for (let i = 0; i < 8000; i++) {
    const arm = i%2, ao = arm*Math.PI;
    const t = Math.pow(Math.random(),0.55);
    let r = 0.08+t*0.7, a = t*Math.PI*2*1.8+ao;
    const sp = 0.015+t*0.04;
    const nx = (Math.sin(i*12.9+78.2)*43758.5%1-0.5)*sp;
    a += (Math.sin(i*34.7+12.4)*43758.5%1-0.5)*0.15;
    pos.push(Math.cos(a)*r+nx, (Math.random()-0.5)*0.008, Math.sin(a)*r);
    const rnd = Math.random();
    if(rnd<0.15){const b=0.7+Math.random()*0.6;col.push(1*b,0.3*b,0.35*b);}
    else if(rnd<0.25){const b=0.15+Math.random()*0.15;col.push(0.5*b,0.3*b,0.15*b);}
    else if(rnd<0.6){const b=0.25+Math.random()*0.3;col.push(0.55*b,0.65*b,0.85*b);}
    else{const b=0.2+Math.random()*0.2;col.push(0.5*b,0.6*b,0.75*b);}
  }

  for (let i = 0; i < 500; i++) {
    const arm = i%2, ao = arm*Math.PI;
    const t = 0.2+Math.random()*0.6;
    const r = 0.08+t*0.7, a = t*Math.PI*2*1.8+ao+(Math.random()-0.5)*0.1;
    pos.push(Math.cos(a)*r+(Math.random()-0.5)*0.015, (Math.random()-0.5)*0.003, Math.sin(a)*r+(Math.random()-0.5)*0.015);
    const b = 1+Math.random()*0.5;
    col.push(1*b,0.25*b,0.3*b);
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genTriangulum() {
  const pos = [], col = [];

  for (let i = 0; i < 2000; i++) {
    const th = Math.random()*Math.PI*2, r = Math.pow(Math.random(),2)*0.12;
    pos.push(r*Math.cos(th), (Math.random()-0.5)*0.008, r*Math.sin(th));
    const b = 0.7+Math.random()*0.5;
    col.push(1*b,0.95*b,0.8*b);
  }

  for (let i = 0; i < 8000; i++) {
    const arm = i%3, ao = arm*Math.PI*2/3;
    const t = Math.pow(Math.random(),0.5);
    let r = 0.05+t*0.65, a = t*Math.PI*2*1.0+ao;
    const sp = 0.03+t*0.08;
    const nx = (Math.sin(i*12.9+78.2)*43758.5%1-0.5)*sp;
    const nz = (Math.sin(i*23.4+91.1)*43758.5%1-0.5)*sp;
    a += (Math.sin(i*34.7+12.4)*43758.5%1-0.5)*0.3;
    pos.push(Math.cos(a)*r+nx, (Math.random()-0.5)*0.015, Math.sin(a)*r+nz);
    const rnd = Math.random();
    if(rnd<0.18){const b=0.6+Math.random()*0.6;col.push(1*b,0.4*b,0.5*b);}
    else if(rnd<0.45){const b=0.3+Math.random()*0.4;col.push(0.4*b,0.8*b,0.95*b);}
    else if(rnd<0.6){const b=0.35+Math.random()*0.3;col.push(0.85*b,0.85*b,0.9*b);}
    else{const b=0.15+Math.random()*0.2;col.push(0.6*b,0.75*b,0.85*b);}
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function genAndromeda() {
  const pos = [], col = [];

  for (let i = 0; i < 4000; i++) {
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    const r = Math.pow(Math.random(),1.8)*0.2;
    pos.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th)*0.5, r*Math.cos(ph)*0.5);
    const b = 0.8+(1-r/0.2)*0.5+Math.random()*0.2;
    if(r/0.2<0.3) col.push(1*b,0.95*b,0.82*b);
    else col.push(1*b,0.85*b,0.6*b);
  }

  for (let i = 0; i < 8000; i++) {
    const arm = i%2, ao = arm*Math.PI;
    const t = Math.pow(Math.random(),0.5);
    let r = 0.1+t*0.7, a = t*Math.PI*2*1.2+ao;
    const sp = 0.015+t*0.04;
    const nx = (Math.sin(i*12.9+78.2)*43758.5%1-0.5)*sp;
    a += (Math.sin(i*34.7+12.4)*43758.5%1-0.5)*0.15;
    let x = Math.cos(a)*r+nx, z = Math.sin(a)*r*0.3;
    let y = (Math.random()-0.5)*0.012;
    pos.push(x,y,z);
    const rnd = Math.random();
    if(rnd<0.08){const b=0.15+Math.random()*0.12;col.push(0.5*b,0.3*b,0.15*b);}
    else if(rnd<0.35){const b=0.2+Math.random()*0.25;col.push(0.6*b,0.65*b,0.8*b);}
    else if(rnd<0.55){const b=0.25+Math.random()*0.2;col.push(0.75*b,0.72*b,0.8*b);}
    else{const b=0.15+Math.random()*0.15;col.push(0.8*b,0.75*b,0.65*b);}
  }
  return {positions:new Float32Array(pos),colors:new Float32Array(col)};
}

function getSpecialGalaxyData(galaxyId) {
  switch(galaxyId) {
    case 'M104': return genSombrero();
    case 'M87': return genVirgoA();
    case 'NGC253': return genSculptor();
    case 'M81': return genBode();
    case 'M51': return genWhirlpool();
    case 'M33': return genTriangulum();
    case 'M31': return genAndromeda();
    default: return null;
  }
}

const SPECIAL_GLOW = {
  M104: '#ffeecc', M87: '#ffcc88', NGC253: '#cc99ff', M81: '#aabbff',
  M51: '#ff6666', M33: '#66ddee', M31: '#ffddaa'
};

function SpecialGalaxy({ galaxy, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const rotRef = useRef();
  const position = useMemo(() => raDecTo3D(galaxy.ra, galaxy.dec, CELESTIAL_SPHERE_RADIUS * 0.96), [galaxy.ra, galaxy.dec]);

  const angularArcmin = galaxy.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const fixedBaseSize = Math.max(0.2, realSize);

  const { positions: cloudPos, colors: cloudCol } = useMemo(() => {
    return getSpecialGalaxyData(galaxy.id) || {positions:new Float32Array(0),colors:new Float32Array(0)};
  }, [galaxy.id]);

  const glowColor = SPECIAL_GLOW[galaxy.id] || '#aaaaff';

  useFrame(({ camera, clock }) => {
    if (rotRef.current) rotRef.current.rotation.z = clock.elapsedTime * 0.025;
    if (billboardRef.current) {
      const pq = new THREE.Quaternion(); billboardRef.current.parent.getWorldQuaternion(pq); billboardRef.current.quaternion.copy(pq.invert().multiply(camera.quaternion));
    }
  });

  const s = fixedBaseSize;
  if (cloudPos.length === 0) return null;

  return (
    <group position={position} scale={[s, s, s]}>
      <group ref={billboardRef}>
        <group ref={rotRef}>
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={cloudPos.length / 3} array={cloudPos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={cloudCol.length / 3} array={cloudCol} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.018} vertexColors transparent opacity={0.9} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
        </group>
      </group>
      {showLabels && (
        <Html zIndexRange={[1, 0]} position={[1.2, 0.6, 0]} style={{ color: glowColor, fontSize: `${10+(60-fov)/10}px`, fontFamily: 'Exo 2, sans-serif', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap', textShadow: `0 0 8px ${glowColor}` }}>
          <span onClick={(e) => { e.stopPropagation(); onClick(galaxy); }}>{galaxy.name}</span>
        </Html>
      )}
      {isSelected && (
        <mesh rotation={[Math.PI/2,0,0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function ConstellationLines({ showConstellations, showLabels, onConstellationClick, constellationData, brightStars }) {
  if (!showConstellations) return null;

  const linePoints = useMemo(() => {
    return constellationData.map(constellation => ({
      name: constellation.name,
      nameHu: constellation.nameHu,
      labelPos: constellation.labelPos,
      lines: constellation.lines.map(line =>
        line.map(starId => {
          const star = brightStars.find(s => s.id === starId);
          return star ? raDecTo3D(star.ra, star.dec, CELESTIAL_SPHERE_RADIUS * 0.999) : null;
        }).filter(Boolean)
      ).filter(pts => pts.length >= 2)
    }));
  }, [constellationData, brightStars]);

  return (
    <>
      {linePoints.map((constellation) => (
        <group key={constellation.name}>
          {constellation.lines.map((points, lineIndex) => (
            <Line
              key={`${constellation.name}-line-${lineIndex}`}
              points={points}
              color="#5577aa"
              lineWidth={1.5}
              transparent
              opacity={0.7}
            />
          ))}
          {showLabels && constellation.labelPos && (
            <Html zIndexRange={[1, 0]}
              position={raDecTo3D(constellation.labelPos.ra, constellation.labelPos.dec, CELESTIAL_SPHERE_RADIUS * 1.01)}
              style={{
                color: '#6699cc',
                fontSize: '11px',
                fontFamily: 'Exo 2, sans-serif',
                pointerEvents: 'auto',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                opacity: 0.9,
                textShadow: '0 0 6px rgba(100,150,200,0.5)',
                cursor: 'pointer',
              }}
            >
              <span onClick={(e) => { e.stopPropagation(); onConstellationClick && onConstellationClick(constellation); }}>
                {constellation.nameHu}
              </span>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

function CoordinateGrid({ showGrid }) {
  if (!showGrid) return null;

  const lines = useMemo(() => {
    const result = [];

    for (let ra = 0; ra < 24; ra += 2) {
      const points = [];
      for (let dec = -80; dec <= 80; dec += 5) {
        points.push(raDecTo3D(ra, dec, CELESTIAL_SPHERE_RADIUS * 1.001));
      }
      result.push({ points, type: 'ra', label: `${ra}h`, ra, dec: 0 });
    }

    for (let dec = -60; dec <= 60; dec += 30) {
      const points = [];
      for (let ra = 0; ra <= 24; ra += 0.25) {
        points.push(raDecTo3D(ra, dec, CELESTIAL_SPHERE_RADIUS * 1.001));
      }
      result.push({ points, type: 'dec', label: `${dec >= 0 ? '+' : ''}${dec}°`, ra: 0, dec });
    }

    return result;
  }, []);

  return (
    <>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color={line.type === 'ra' ? '#2a6090' : '#208050'}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
      {}
      {lines.filter(l => l.label).map((line, i) => (
        <Html
          key={`grid-label-${i}`}
          zIndexRange={[1, 0]}
          position={raDecTo3D(line.ra, line.type === 'ra' ? 5 : line.dec, CELESTIAL_SPHERE_RADIUS * 1.005)}
          style={{
            color: line.type === 'ra' ? '#4488bb' : '#44aa66',
            fontSize: '9px',
            fontFamily: 'Exo 2, sans-serif',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            opacity: 0.7,
          }}
        >
          {line.label}
        </Html>
      ))}
    </>
  );
}

function Horizon({ latitude, lst, showLabels }) {
  const points = useMemo(() => {
    const pts = [];
    for (let az = 0; az <= 360; az += 5) {
      const azRad = az * Math.PI / 180;
      pts.push(new THREE.Vector3(
        CELESTIAL_SPHERE_RADIUS * 1.02 * Math.sin(azRad),
        0,
        CELESTIAL_SPHERE_RADIUS * 1.02 * Math.cos(azRad)
      ));
    }
    return pts;
  }, []);

  const cardinalPoints = [
    { label: 'É', az: 0 },
    { label: 'K', az: 90 },
    { label: 'D', az: 180 },
    { label: 'NY', az: 270 },
  ];

  return (
    <group>
      <Line points={points} color="#006633" lineWidth={2} transparent opacity={0.6} />

      {showLabels && cardinalPoints.map((point) => {
        const azRad = point.az * Math.PI / 180;
        return (
          <Html zIndexRange={[1, 0]}
            key={point.label}
            position={[
              CELESTIAL_SPHERE_RADIUS * 1.05 * Math.sin(azRad),
              2,
              CELESTIAL_SPHERE_RADIUS * 1.05 * Math.cos(azRad)
            ]}
            style={{
              color: '#00ff66',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'Orbitron, sans-serif',
              pointerEvents: 'none',
            }}
          >
            {point.label}
          </Html>
        );
      })}
    </group>
  );
}

function CelestialEquator() {
  const points = useMemo(() => {
    const pts = [];
    for (let ra = 0; ra <= 24; ra += 0.25) {
      pts.push(raDecTo3D(ra, 0, CELESTIAL_SPHERE_RADIUS * 1.002));
    }
    return pts;
  }, []);

  return <Line points={points} color="#00aaff" lineWidth={1} transparent opacity={0.4} />;
}

function CelestialScene({
  date, latitude, longitude, lst,
  showPlanets, showConstellations, showEqGrid, showLabels,
  selectedObject, setSelectedObject, allStars,
  fov, setFov, focusTarget, onFocusComplete,
  celestialData
}) {
  const {
    planets, moonData, sunData, constellationData, brightStars,
    galaxies: galaxiesData, nebulaeData, exoplanetsData, deepSkyObjects
  } = celestialData;
  const handleStarClick = useCallback((star) => {
    setSelectedObject({ ...star, type: 'star' });
  }, [setSelectedObject]);

  const handlePlanetClick = useCallback((planet) => {
    setSelectedObject({ ...planet, type: 'planet' });
  }, [setSelectedObject]);

  const handleMoonClick = useCallback((moon) => {
    setSelectedObject({ ...moon, type: 'moon' });
  }, [setSelectedObject]);

  const handleSunClick = useCallback((sun) => {
    setSelectedObject({ ...sun, type: 'sun' });
  }, [setSelectedObject]);

  const handleConstellationClick = useCallback((constellation) => {
    setSelectedObject({ ...constellation, type: 'constellation' });
  }, [setSelectedObject]);

  const handleGalaxyClick = useCallback((galaxy) => {
    setSelectedObject({ ...galaxy, galaxyType: galaxy.type, type: 'galaxy' });
  }, [setSelectedObject]);

  const skyRotation = useMemo(() => {
    const lstRad = -lst * 15 * Math.PI / 180;
    const latRad = -(90 - latitude) * Math.PI / 180;
    return [latRad, lstRad, 0];
  }, [lst, latitude]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[50, 20, 30]} intensity={1.0} color="#fffaf0" />

      <SkyBackground />

      {}
      <group rotation={skyRotation}>
        <StarsField
          stars={allStars}
          showLabels={showLabels}
          onStarClick={handleStarClick}
          selectedObject={selectedObject}
          fov={fov}
        />

        {showPlanets && planets.map((planet) => (
          <Planet3D
            key={planet.id}
            planet={planet}
            date={date}
            showLabels={showLabels}
            onClick={handlePlanetClick}
            isSelected={selectedObject?.id === planet.id && selectedObject?.type === 'planet'}
            fov={fov}
          />
        ))}

        {showPlanets && (
          <Moon3D
            date={date}
            showLabels={showLabels}
            onClick={handleMoonClick}
            isSelected={selectedObject?.id === 'moon'}
            fov={fov}
            moonData={moonData}
          />
        )}

        {showPlanets && (
          <Sun3D
            date={date}
            showLabels={showLabels}
            onClick={handleSunClick}
            isSelected={selectedObject?.id === 'sun'}
            fov={fov}
            sunData={sunData}
          />
        )}

        {}
        {galaxiesData && galaxiesData.map((galaxy) => {
          if (galaxy.id === 'LMC' || galaxy.id === 'SMC') {
            return (
              <MagellanicCloud
                key={galaxy.id}
                galaxy={galaxy}
                showLabels={showLabels}
                onClick={handleGalaxyClick}
                isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
                fov={fov}
              />
            );
          }
          if (galaxy.id === 'M82') {
            return (
              <CigarGalaxy
                key={galaxy.id}
                galaxy={galaxy}
                showLabels={showLabels}
                onClick={handleGalaxyClick}
                isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
                fov={fov}
              />
            );
          }
          if (galaxy.id === 'NGC5128') {
            return (
              <CentaurusAGalaxy
                key={galaxy.id}
                galaxy={galaxy}
                showLabels={showLabels}
                onClick={handleGalaxyClick}
                isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
                fov={fov}
              />
            );
          }
          if (['M104','M87','NGC253','M81','M51','M33','M31'].includes(galaxy.id)) {
            return (
              <SpecialGalaxy
                key={galaxy.id}
                galaxy={galaxy}
                showLabels={showLabels}
                onClick={handleGalaxyClick}
                isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
                fov={fov}
              />
            );
          }
          if (galaxy.id === 'M101') {
            return (
              <PinwheelGalaxy
                key={galaxy.id}
                galaxy={galaxy}
                showLabels={showLabels}
                onClick={handleGalaxyClick}
                isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
                fov={fov}
              />
            );
          }
          return (
            <Galaxy3D
              key={galaxy.id}
              galaxy={galaxy}
              showLabels={showLabels}
              onClick={handleGalaxyClick}
              isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
              fov={fov}
            />
          );
        })}
        {deepSkyObjects && deepSkyObjects.filter(obj => obj.type === 'galaxy' && !(galaxiesData || []).find(g => g.id === obj.id)).map((galaxy) => (
          <Galaxy3D
            key={galaxy.id}
            galaxy={{...galaxy, type: 'spiral'}}
            showLabels={showLabels}
            onClick={handleGalaxyClick}
            isSelected={selectedObject?.id === galaxy.id && selectedObject?.type === 'galaxy'}
            fov={fov}
          />
        ))}

        {}
        {nebulaeData && nebulaeData.map((nebula) => (
          <Nebula3D
            key={`neb-${nebula.id}`}
            nebula={nebula}
            showLabels={showLabels}
            onClick={(n) => setSelectedObject({ ...n, nebulaType: n.type, type: 'nebula' })}
            isSelected={selectedObject?.id === nebula.id && selectedObject?.type === 'nebula'}
            fov={fov}
          />
        ))}

        {}
        {exoplanetsData && exoplanetsData.map((exo) => (
          <Exoplanet3D
            key={`exo-${exo.id}`}
            exoplanet={exo}
            showLabels={showLabels}
            onClick={(e) => setSelectedObject({ ...e, type: 'exoplanet' })}
            isSelected={selectedObject?.id === exo.id && selectedObject?.type === 'exoplanet'}
            fov={fov}
          />
        ))}

        <ConstellationLines showConstellations={showConstellations} showLabels={showConstellations} onConstellationClick={handleConstellationClick} constellationData={cdConstellations} brightStars={cdStars} />
        <CoordinateGrid showGrid={showEqGrid} />
        <CelestialEquator />
      </group>
      {}

      {}
      <Horizon latitude={latitude} lst={lst} showLabels={showLabels} />

      <StereographicControls
        latitude={latitude}
        lst={lst}
        fov={fov}
        setFov={setFov}
        focusTarget={focusTarget}
        onFocusComplete={onFocusComplete}
      />
    </>
  );
}

export default function App() {
  const [date, setDate] = useState(new Date());
  const [latitude, setLatitude] = useState(47.9);
  const [longitude, setLongitude] = useState(20.37);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [showPlanets, setShowPlanets] = useState(true);
  const [showConstellations, setShowConstellations] = useState(true);
  const [showEqGrid, setShowEqGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedObject, setSelectedObject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSettings, setShowSettings] = useState(true);
  const [showNASA, setShowNASA] = useState(false);
  const [fov, setFov] = useState(75);
  const [focusTarget, setFocusTarget] = useState(null);

  const { data: dbData, loading: dbLoading, error: dbError } = usePlanetariumDB();
  const {
    brightStars, constellationData, planets, moonData, sunData,
    galaxies: galaxiesData, nebulaeData, exoplanetsData, deepSkyObjects
  } = dbData;

  const allStars = useMemo(() => brightStars, [brightStars]);

  const lst = useMemo(() => calculateLST(date, longitude), [date, longitude]);

  const lastFrameTime = useRef(Date.now());
  useEffect(() => {
    if (!isPlaying) return;
    let animId;
    const animate = () => {
      const now = Date.now();
      const dt = now - lastFrameTime.current;
      lastFrameTime.current = now;

      const simMs = timeSpeed * dt;
      setDate(d => new Date(d.getTime() + simMs));
      animId = requestAnimationFrame(animate);
    };
    lastFrameTime.current = Date.now();
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, timeSpeed]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    brightStars.forEach(star => {
      if (star.name && star.name.toLowerCase().includes(query)) {
        results.push({ ...star, type: 'star' });
      }
    });

    planets.forEach(planet => {
      if (planet.name.toLowerCase().includes(query)) {
        const pos = calculatePlanetPosition(planet, date);
        results.push({ ...planet, type: 'planet', ra: pos.ra, dec: pos.dec });
      }
    });

    constellationData.forEach(const_ => {
      if (const_.name.toLowerCase().includes(query) || const_.nameHu.toLowerCase().includes(query)) {
        results.push({ ...const_, type: 'constellation' });
      }
    });

    if ('hold'.includes(query) || 'moon'.includes(query)) {
      const moonPos = calculateMoonPosition(date);
      results.push({ ...moonData, type: 'moon', ra: moonPos.ra, dec: moonPos.dec });
    }

    if ('nap'.includes(query) || 'sun'.includes(query)) {
      const sunPos = calculateSunPosition(date);
      results.push({ ...sunData, type: 'sun', ra: sunPos.ra, dec: sunPos.dec });
    }

    if (galaxiesData) {
      galaxiesData.forEach(galaxy => {
        if (galaxy.name.toLowerCase().includes(query) || (galaxy.nameEn && galaxy.nameEn.toLowerCase().includes(query))) {
          results.push({ ...galaxy, type: 'galaxy' });
        }
      });
    }
    if (deepSkyObjects) {
      deepSkyObjects.filter(obj => obj.type === 'galaxy' && !(galaxiesData || []).find(g => g.id === obj.id)).forEach(galaxy => {
        if (galaxy.name.toLowerCase().includes(query)) {
          results.push({ ...galaxy, type: 'galaxy' });
        }
      });
    }

    if (nebulaeData) {
      nebulaeData.forEach(nebula => {
        if (nebula.name.toLowerCase().includes(query) || (nebula.nameEn && nebula.nameEn.toLowerCase().includes(query)) || (nebula.id && nebula.id.toLowerCase().includes(query))) {
          results.push({ ...nebula, type: 'nebula' });
        }
      });
    }

    if (exoplanetsData) {
      exoplanetsData.forEach(exo => {
        if (exo.name.toLowerCase().includes(query) || (exo.hostStar && exo.hostStar.toLowerCase().includes(query))) {
          results.push({ ...exo, type: 'exoplanet', ra: exo.ra / 15, dec: exo.dec });
        }
      });
    }

    setSearchResults(results.slice(0, 15));
  }, [searchQuery, date, brightStars, planets, constellationData, moonData, sunData, galaxiesData, deepSkyObjects, nebulaeData, exoplanetsData]);

  const handleSearchSelect = (item) => {
    setSelectedObject(item);
    setSearchQuery('');
    setSearchResults([]);
    setShowLabels(true);

    if (item.ra !== undefined && item.dec !== undefined) {
      setFocusTarget(raDecToFocusTarget(item.ra, item.dec));
      const smartFov = item.size_arcmin > 120
        ? Math.min(80, Math.max(35, item.size_arcmin / 60 * 3.5))
        : 30;
      if (fov > smartFov) setFov(smartFov);
    } else if (item.type === 'constellation' && item.labelPos) {
      setFocusTarget(raDecToFocusTarget(item.labelPos.ra, item.labelPos.dec));
      if (fov > 30) setFov(30);
    }
  };

  const raDecToFocusTarget = useCallback((ra, dec) => {
    const raRad = (ra * 15) * Math.PI / 180;
    const decRad = dec * Math.PI / 180;
    const rawPos = new THREE.Vector3(
      Math.cos(decRad) * Math.cos(raRad),
      Math.sin(decRad),
      -Math.cos(decRad) * Math.sin(raRad)
    );
    const lstRad = -lst * 15 * Math.PI / 180;
    const latRad = -(90 - latitude) * Math.PI / 180;
    rawPos.applyEuler(new THREE.Euler(latRad, lstRad, 0, 'XYZ'));
    const phi = Math.acos(Math.max(-1, Math.min(1, rawPos.y)));
    const theta = Math.atan2(rawPos.x, rawPos.z);
    return { phi, theta };
  }, [lst, latitude]);

  const handleFocusOnSelected = () => {
    if (!selectedObject) return;
    if (selectedObject.ra !== undefined && selectedObject.dec !== undefined) {
      setFocusTarget(raDecToFocusTarget(selectedObject.ra, selectedObject.dec));
      const smartFov = selectedObject.size_arcmin > 120
        ? Math.min(80, Math.max(35, selectedObject.size_arcmin / 60 * 3.5))
        : 30;
      if (fov > smartFov) setFov(smartFov);
    } else if (selectedObject.type === 'constellation' && selectedObject.labelPos) {
      setFocusTarget(raDecToFocusTarget(selectedObject.labelPos.ra, selectedObject.labelPos.dec));
      if (fov > 30) setFov(30);
    }
  };

  const handleFocusComplete = () => setFocusTarget(null);

  const formatDate = (d) => d.toISOString().split('T')[0];
  const formatTime = (d) => d.toTimeString().slice(0, 5);

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

  if (dbLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-b from-[#030508] via-[#0a0f1a] to-[#030508]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔭</div>
          <h1 className="font-orbitron text-xl text-cyan-400 mb-2">PLANETÁRIUM 3D</h1>
          <p className="text-gray-500 text-sm font-exo">Adatbázis betöltése...</p>
          {dbError && (
            <p className="text-red-400 text-xs mt-4 max-w-xs">
              ⚠️ {dbError}<br/>
              <span className="text-gray-600">Ellenőrizd, hogy a backend fut-e (uvicorn main:app --reload)</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#030508] via-[#0a0f1a] to-[#030508] overflow-hidden">
      {}
      <header className="h-14 sm:h-16 glass-dark flex items-center justify-between px-3 sm:px-6 z-50 relative">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="font-orbitron text-base sm:text-xl font-bold tracking-wider">
            <span className="text-cyan-400 glow-text">PLANETÁRIUM</span>
            <span className="text-gray-500 text-xs sm:text-sm ml-1 sm:ml-2">3D</span>
          </h1>
        </div>

        {}
        <div className="relative flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-8">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keresés..."
            className="w-full rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-exo placeholder-gray-600"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 max-h-80 overflow-y-auto" style={{ background: '#080e18', border: '1px solid rgba(0,212,255,0.15)' }}>
              {searchResults.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSearchSelect(item)}
                  className="w-full px-4 py-3 text-left text-sm font-exo hover:bg-cyan-500/20 flex items-center justify-between border-b border-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {item.type === 'star' ? '⭐' : item.type === 'planet' ? '🪐' : item.type === 'moon' ? '🌙' : item.type === 'sun' ? '☀️' : item.type === 'galaxy' ? '🌌' : '⭐'}
                    </span>
                    <span className="text-white">{item.name || item.nameHu}</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 uppercase bg-cyan-500/10 px-2 py-1 rounded">
                    {item.type === 'star' ? 'Csillag' : item.type === 'planet' ? 'Bolygó' : item.type === 'moon' ? 'Hold' : item.type === 'sun' ? 'Nap' : item.type === 'galaxy' ? 'Galaxis' : 'Csillagkép'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setShowNASA(true)} className="btn-cyber px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-exo text-xs sm:text-sm text-cyan-400">
            🛰️ <span className="hidden sm:inline">NASA</span>
          </button>
          <div
            onClick={() => setShowSettings(prev => !prev)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer select-none"
            style={{ border: '1px solid rgba(0,212,255,0.2)' }}
          >
            <span className="text-sm text-cyan-400 font-exo">⚙️</span>
            <div className={`toggle-cyber ${showSettings ? 'active' : ''}`}>
              <div className="toggle-dot" />
            </div>
          </div>
        </div>
      </header>

      {}
      <div className="flex-1 flex relative">
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 0.001], fov: fov, near: 0.001, far: 500 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            dpr={[1, 1.5]}
          >
            <Suspense fallback={null}>
              <CelestialScene
                date={date}
                latitude={latitude}
                longitude={longitude}
                lst={lst}
                showPlanets={showPlanets}
                showConstellations={showConstellations}
                showEqGrid={showEqGrid}
                showLabels={showLabels && !showNASA}
                selectedObject={selectedObject}
                setSelectedObject={setSelectedObject}
                allStars={allStars}
                fov={fov}
                setFov={setFov}
                focusTarget={focusTarget}
                onFocusComplete={handleFocusComplete}
                celestialData={dbData}
              />
            </Suspense>
          </Canvas>

          {}
          <div className="absolute bottom-4 left-4 glass rounded-lg px-4 py-2 flex items-center gap-6">
            <div className="text-cyan-400 text-sm font-mono">
              <span className="text-gray-500">FOV</span> {fov.toFixed(1)}°
            </div>
            <div className="text-sm font-mono text-gray-500">
              {fov > 60 ? '🌐 Szabad szem' : fov > 20 ? '👁️ Normál' : '🔭 Távcső'}
            </div>
          </div>

          {}
          <div className="absolute bottom-4 glass rounded-lg px-4 py-2 flex items-center gap-4" style={{ right: showSettings ? '376px' : '16px', transition: 'right 0.3s ease' }}>
            <div className="text-xs font-mono text-gray-500">
              LST <span className="text-cyan-400">{lst.toFixed(2)}h</span>
            </div>
            <div className="text-xs font-mono text-gray-500">
              Csillagok <span className="text-cyan-400">{allStars.length}</span>
            </div>
          </div>
        </div>

        {}
        {selectedObject && !showNASA && (
          <div
            className="absolute top-2 left-2 sm:top-4 sm:left-4 rounded-xl p-4 sm:p-5 z-40"
            style={{
              background: '#080e18',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              maxHeight: '85vh',
              width: 'min(320px, calc(100vw - 16px))',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-orbitron text-lg font-bold text-cyan-400">
                  {selectedObject.type === 'constellation'
                    ? (selectedObject.nameHu || selectedObject.name)
                    : (selectedObject.name || selectedObject.nameHu || selectedObject.bayer ||
                       (selectedObject.type === 'star' ? `Csillag #${selectedObject.id}` : `#${selectedObject.id}`))}
                </h3>
                {(selectedObject.ra !== undefined || (selectedObject.type === 'constellation' && selectedObject.labelPos)) && (
                  <button
                    onClick={handleFocusOnSelected}
                    title="Fókuszálás"
                    style={{
                      background: 'rgba(0, 212, 255, 0.15)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.target.style.background = 'rgba(0, 212, 255, 0.3)'; e.target.style.boxShadow = '0 0 10px rgba(0,212,255,0.4)'; }}
                    onMouseLeave={(e) => { e.target.style.background = 'rgba(0, 212, 255, 0.15)'; e.target.style.boxShadow = 'none'; }}
                  >🔍</button>
                )}
              </div>
              <button onClick={() => setSelectedObject(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                  {selectedObject.type === 'star' ? `Csillag • ${selectedObject.constellation || ''}` :
                   selectedObject.type === 'planet' ? 'Bolygó • Naprendszer' :
                   selectedObject.type === 'moon' ? 'Hold • Természetes műhold' :
                   selectedObject.type === 'sun' ? 'Csillag • G2V' :
                   selectedObject.type === 'nebula' ? `Köd • ${
                     {'emission': 'Emissziós', 'planetary': 'Planetáris', 'dark': 'Sötét', 'reflection': 'Reflexiós', 'supernova_remnant': 'Szupernóva'}[selectedObject.nebulaType] || 'Köd'
                   }` :
                   selectedObject.type === 'exoplanet' ? `Exobolygó • ${selectedObject.hostStar || ''}${selectedObject.isHabitableZone ? ' 🌱' : ''}` :
                   selectedObject.type === 'galaxy' ? `Galaxis • ${(selectedObject.galaxyType || selectedObject.type || 'spirál').charAt(0).toUpperCase() + (selectedObject.galaxyType || 'spirál').slice(1)}` :
                   selectedObject.type === 'constellation' ? `Csillagkép • ${selectedObject.name || ''}` : ''}
                </p>

            {selectedObject.description && <p className="text-sm text-gray-400 mb-4 leading-relaxed">{selectedObject.description}</p>}

            <div className="space-y-2 text-sm">
              {selectedObject.bayer && selectedObject.bayer !== selectedObject.name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Jelölés</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.bayer}</span>
                </div>
              )}
              {selectedObject.mag !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fényesség</span>
                  <span className="text-cyan-400 font-mono font-bold">{selectedObject.mag.toFixed(2)} mag</span>
                </div>
              )}
              {selectedObject.constellation && selectedObject.type === 'star' && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Csillagkép</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.constellation}</span>
                </div>
              )}
              {selectedObject.color && selectedObject.type === 'star' && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Szín</span>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: selectedObject.color, display: 'inline-block', boxShadow: `0 0 6px ${selectedObject.color}` }} />
                    <span className="text-cyan-400 font-mono">{selectedObject.color}</span>
                  </span>
                </div>
              )}
              {selectedObject.spectralType && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Spektráltípus</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.spectralType}</span>
                </div>
              )}
              {selectedObject.ra !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ra/Dec</span>
                  <span className="text-cyan-400 font-mono">
                    {Math.floor(selectedObject.ra)}h {Math.floor((selectedObject.ra % 1) * 60)}m / {selectedObject.dec >= 0 ? '+' : ''}{selectedObject.dec.toFixed(2)}°
                  </span>
                </div>
              )}
              {selectedObject.distance && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Távolság</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.distance}</span>
                </div>
              )}
              {selectedObject.distance_ly && !selectedObject.distance && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Távolság</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.distance_ly >= 1000000 ? `${(selectedObject.distance_ly / 1000000).toFixed(1)}M ly` : selectedObject.distance_ly >= 1000 ? `${(selectedObject.distance_ly / 1000).toFixed(1)}k ly` : `${selectedObject.distance_ly} ly`}</span>
                </div>
              )}
              {selectedObject.diameter_ly && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Átmérő</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.diameter_ly.toLocaleString()} ly</span>
                </div>
              )}
              {selectedObject.discoveryYear && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Felfedezés</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.discoveryYear} • {selectedObject.discoveryMethod || ''}</span>
                </div>
              )}
              {selectedObject.hostStar && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Csillag</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.hostStar}</span>
                </div>
              )}
              {selectedObject.massEarth && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tömeg</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.massEarth.toFixed(2)} M⊕</span>
                </div>
              )}
              {selectedObject.radiusEarth && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sugár</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.radiusEarth.toFixed(2)} R⊕</span>
                </div>
              )}
              {selectedObject.equilibriumTempK && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Hőmérséklet</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.equilibriumTempK} K ({(selectedObject.equilibriumTempK - 273).toFixed(0)}°C)</span>
                </div>
              )}
              {selectedObject.size_arcmin && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Méret</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.size_arcmin}'</span>
                </div>
              )}
              {selectedObject.phase !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Holdfázis</span>
                  <span className="text-yellow-400">{getMoonPhaseName(selectedObject.phase)}</span>
                </div>
              )}
              {selectedObject.illumination !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Megvilágítás</span>
                  <span className="text-yellow-400 font-mono">{(selectedObject.illumination * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>

            {}
            {selectedObject.type === 'constellation' && selectedObject.lines && (
              <div className="space-y-2 text-sm mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.1)' }}>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vonalak</span>
                  <span className="text-cyan-400 font-mono">{selectedObject.lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Csillagok</span>
                  <span className="text-cyan-400 font-mono">{[...new Set(selectedObject.lines.flat())].length}</span>
                </div>
                {selectedObject.labelPos && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Közép (RA/Dec)</span>
                    <span className="text-cyan-400 font-mono">
                      {Math.floor(selectedObject.labelPos.ra)}h {Math.floor((selectedObject.labelPos.ra % 1) * 60)}m / {selectedObject.labelPos.dec >= 0 ? '+' : ''}{selectedObject.labelPos.dec.toFixed(1)}°
                    </span>
                  </div>
                )}
              </div>
            )}

            {}
            <AladinInlineViewer selectedObject={selectedObject} fov={fov} />
          </div>
        )}

        {}
        {showSettings && (
          <div
            className="p-4 sm:p-5 overflow-y-auto"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(320px, 90vw)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 30,
              background: '#080e18',
              borderLeft: '1px solid rgba(0, 212, 255, 0.15)',
            }}
          >
            <h2 className="font-orbitron text-sm text-cyan-400 mb-4 tracking-wider">BEÁLLÍTÁSOK</h2>

            <div className="mb-5">
              <h3 className="text-xs text-gray-500 uppercase mb-3">Idő</h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`flex-1 py-2 rounded-lg text-sm font-exo ${isPlaying ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                  {isPlaying ? '⏸ Szünet' : '▶ Lejátszás'}
                </button>
                <button onClick={() => setDate(new Date())} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm">Most</button>
              </div>

              {}
              <div className="mb-3">
                <label className="text-xs text-gray-600 mb-1 block">Időléptetés</label>
                <div className="grid grid-cols-6 gap-1">
                  <button onClick={() => setDate(d => new Date(d.getTime() - 86400000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">-1n</button>
                  <button onClick={() => setDate(d => new Date(d.getTime() - 3600000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">-1ó</button>
                  <button onClick={() => setDate(d => new Date(d.getTime() - 60000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">-1p</button>
                  <button onClick={() => setDate(d => new Date(d.getTime() + 60000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">+1p</button>
                  <button onClick={() => setDate(d => new Date(d.getTime() + 3600000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">+1ó</button>
                  <button onClick={() => setDate(d => new Date(d.getTime() + 86400000))} className="py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-gray-700">+1n</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="date" value={formatDate(date)} onChange={(e) => setDate(new Date(e.target.value + 'T' + formatTime(date)))} className="rounded-lg px-3 py-2 text-xs sm:text-sm" />
                <input type="time" value={formatTime(date)} onChange={(e) => setDate(new Date(formatDate(date) + 'T' + e.target.value))} className="rounded-lg px-3 py-2 text-xs sm:text-sm" />
              </div>

              {}
              <div className="mt-2">
                <label className="text-xs text-gray-600 mb-1 block">
                  Sebesség: {
                    timeSpeed === 1 ? 'Valós idő (1×)' :
                    timeSpeed < 60 ? `${timeSpeed}×` :
                    timeSpeed < 3600 ? `${Math.round(timeSpeed/60)} perc/mp` :
                    `${Math.round(timeSpeed/3600)} óra/mp`
                  }
                </label>
                <div className="grid grid-cols-5 gap-1 mb-1">
                  {[
                    { label: '1×',    val: 1 },
                    { label: '60×',   val: 60 },
                    { label: '300×',  val: 300 },
                    { label: '1000×', val: 1000 },
                    { label: '2000×', val: 2000 },
                  ].map(s => (
                    <button key={s.val} onClick={() => { setTimeSpeed(s.val); if (!isPlaying) setIsPlaying(true); }}
                      className={`py-1 rounded text-xs font-exo ${timeSpeed === s.val && isPlaying ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <input type="range" min="1" max="2000" step="1" value={Math.min(timeSpeed, 2000)}
                  onChange={(e) => setTimeSpeed(Number(e.target.value))} className="w-full" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs text-gray-500 uppercase mb-3">Távcső / FOV</h3>
              <div className="grid grid-cols-4 gap-1 mb-2">
                <button onClick={() => setFov(15)} className={`py-1.5 rounded-lg text-xs font-exo ${fov >= 10 && fov <= 20 ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                  🔭 15°
                </button>
                <button onClick={() => setFov(25)} className={`py-1.5 rounded-lg text-xs font-exo ${fov > 20 && fov <= 27 ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                  👁️ 25°
                </button>
                <button onClick={() => setFov(30)} className={`py-1.5 rounded-lg text-xs font-exo ${fov > 27 && fov <= 50 ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                  👁️ 30°
                </button>
                <button onClick={() => setFov(100)} className={`py-1.5 rounded-lg text-xs font-exo ${fov > 50 ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                  🌐 100°
                </button>
              </div>
              <div>
                <label className="text-xs text-gray-600">FOV: {fov.toFixed(1)}°</label>
                <input type="range" min={15} max={100} step={1} value={fov} onChange={(e) => setFov(Number(e.target.value))} className="w-full mt-1" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs text-gray-500 uppercase mb-3">Helyszín</h3>
              <div className="mb-2">
                <select
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [lat, lon] = e.target.value.split(',').map(Number);
                    setLatitude(lat);
                    setLongitude(lon);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm cursor-pointer"
                  style={{ background: 'rgba(10,20,40,0.6)', border: '1px solid rgba(0,212,255,0.2)', color: 'white' }}
                  value={`${latitude},${longitude}`}
                >
                  <optgroup label="🇭🇺 Magyarország">
                    <option value="47.5,19.04">Budapest</option>
                    <option value="47.9,20.37">Eger</option>
                    <option value="46.25,20.15">Szeged</option>
                    <option value="47.68,17.63">Győr</option>
                    <option value="46.07,18.23">Pécs</option>
                    <option value="47.69,21.62">Debrecen</option>
                  </optgroup>
                  <optgroup label="🇪🇺 Európa">
                    <option value="48.86,2.35">Párizs</option>
                    <option value="51.51,-0.13">London</option>
                    <option value="52.52,13.41">Berlin</option>
                    <option value="41.9,12.5">Róma</option>
                    <option value="48.21,16.37">Bécs</option>
                    <option value="59.33,18.07">Stockholm</option>
                    <option value="40.42,-3.7">Madrid</option>
                  </optgroup>
                  <optgroup label="🌎 Amerika">
                    <option value="40.71,-74.01">New York</option>
                    <option value="34.05,-118.24">Los Angeles</option>
                    <option value="41.88,-87.63">Chicago</option>
                    <option value="-22.91,-43.17">Rio de Janeiro</option>
                    <option value="-34.6,-58.38">Buenos Aires</option>
                  </optgroup>
                  <optgroup label="🌏 Ázsia & Ausztrália">
                    <option value="35.68,139.69">Tokió</option>
                    <option value="39.9,116.4">Peking</option>
                    <option value="28.61,77.21">Újdelhi</option>
                    <option value="1.35,103.82">Szingapúr</option>
                    <option value="-33.87,151.21">Sydney</option>
                  </optgroup>
                  <optgroup label="🌍 Afrika">
                    <option value="30.04,31.24">Kairó</option>
                    <option value="-33.93,18.42">Fokváros</option>
                    <option value="-1.29,36.82">Nairobi</option>
                  </optgroup>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Szélesség</label>
                  <input type="number" value={latitude} onChange={(e) => setLatitude(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 text-sm" step="0.1" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Hosszúság</label>
                  <input type="number" value={longitude} onChange={(e) => setLongitude(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 text-sm" step="0.1" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs text-gray-500 uppercase mb-3">Megjelenítés</h3>
              {[
                { label: 'Bolygók, Nap, Hold', state: showPlanets, setter: setShowPlanets },
                { label: 'Csillagképek + neveik', state: showConstellations, setter: setShowConstellations },
                { label: 'Ekvatoriális rács (RA/Dec)', state: showEqGrid, setter: setShowEqGrid },
                { label: 'Égitestek feliratai', state: showLabels, setter: setShowLabels },
              ].map((option, i) => (
                <label key={i} className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs sm:text-sm text-gray-400">{option.label}</span>
                  <div onClick={() => option.setter(!option.state)} className={`toggle-cyber ${option.state ? 'active' : ''}`}>
                    <div className="toggle-dot" />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between"><span>LST</span><span className="text-cyan-400">{lst.toFixed(2)}h</span></div>
                <div className="flex justify-between"><span>FOV</span><span className="text-cyan-400">{fov.toFixed(1)}°</span></div>
                <div className="flex justify-between"><span>Csillagok</span><span className="text-cyan-400">{allStars.length}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {}
      {showNASA && (
        <NASADashboard isOpen={showNASA} onClose={() => setShowNASA(false)} />
      )}
    </div>
  );
}