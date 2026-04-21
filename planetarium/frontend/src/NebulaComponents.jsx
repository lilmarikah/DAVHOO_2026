import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const CELESTIAL_SPHERE_RADIUS = 100;

const raDecTo3D = (ra, dec, radius = CELESTIAL_SPHERE_RADIUS) => {
  const raRad = (ra * 15) * Math.PI / 180;
  const decRad = dec * Math.PI / 180;
  return new THREE.Vector3(
    radius * Math.cos(decRad) * Math.cos(raRad),
    radius * Math.sin(decRad),
    -radius * Math.cos(decRad) * Math.sin(raRad)
  );
};

const angularSizeToScene = (arcminutes, fov) => {
  return (arcminutes / 60 / fov) * CELESTIAL_SPHERE_RADIUS * 2;
};

const nebulaVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragment = `
  varying vec2 vUv;
  
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uTime;
  uniform float uSeed;
  uniform int uType;
  
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  
  float fbm(vec3 p) {
    float f = 0.0, a = 0.5;
    for(int i = 0; i < 5; i++) {
      f += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return f;
  }
  
  float ridge(vec3 p) {
    float f = 0.0, a = 0.5;
    for(int i = 0; i < 4; i++) {
      float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
      f += a * n;
      p *= 2.1;
      a *= 0.5;
    }
    return f;
  }
  
  float veins(vec3 p) {
    float f = 0.0, a = 0.5;
    for(int i = 0; i < 3; i++) {
      float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
      n = pow(n, 4.0);
      f += a * n;
      p *= 2.5;
      a *= 0.4;
    }
    return f;
  }
  
  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);
    
    float circle = smoothstep(1.0, 0.2, dist);
    if(circle < 0.01) discard;
    
    vec3 p = vec3(uv * 3.0, uSeed * 5.0);
    vec3 q = p + vec3(uTime * 0.05, uTime * 0.03, uTime * 0.02);
    
    float n1 = fbm(q);
    float n2 = ridge(q * 1.3 + n1 * 0.3);
    float v = veins(q * 2.0 + vec3(uTime * 0.04));
    
    float density = 0.0;
    vec3 color = vec3(0.0);
    
    // EMISSION
    if(uType == 0) {
      density = (n1 * 0.5 + n2 * 0.5) * circle;
      density -= fbm(q * 2.5) * 0.3;
      density = max(density, 0.0);
      color = mix(uColor3, uColor2, smoothstep(0.8, 0.3, dist));
      color = mix(color, uColor1, smoothstep(0.4, 0.0, dist) * density);
      color = mix(color, vec3(0.1, 0.6, 1.0), smoothstep(0.5, 0.85, n2) * 0.3);
      color += uColor2 * v * 1.5 * circle;
    }
    // PLANETARY
    else if(uType == 1) {
      float ring = smoothstep(0.15, 0.35, dist) * smoothstep(0.9, 0.6, dist);
      density = (n1 * 0.4 + n2 * 0.6) * ring * circle;
      density -= fbm(q * 3.0) * 0.15;
      density = max(density, 0.0);
      color = mix(uColor3, uColor2, ring);
      color = mix(color, uColor1, smoothstep(0.5, 0.2, dist) * 0.5);
      float star = smoothstep(0.08, 0.0, dist);
      color += vec3(1.0) * star * 3.0;
      density = max(density, star * 0.8);
    }
    // DARK
    else if(uType == 2) {
      density = (n1 * 0.6 + n2 * 0.4) * circle;
      density -= fbm(q * 2.0) * 0.25;
      density = max(density, 0.0);
      color = mix(uColor3, uColor2, smoothstep(0.8, 0.3, dist));
      color = mix(color, uColor1, smoothstep(0.4, 0.0, dist));
      color *= 0.4;
    }
    // REFLECTION
    else if(uType == 3) {
      density = (n1 * 0.3 + n2 * 0.7) * circle * 0.8;
      density -= fbm(q * 3.0) * 0.2;
      density = max(density, 0.0);
      color = mix(uColor3, uColor2, smoothstep(0.9, 0.3, dist));
      color = mix(color, uColor1, smoothstep(0.3, 0.0, dist) * 0.6);
      color += vec3(0.3, 0.5, 1.0) * v * 0.8 * circle;
      float star = smoothstep(0.06, 0.0, dist);
      color += vec3(0.8, 0.9, 1.0) * star * 2.5;
      density = max(density, star * 0.7);
    }
    // SUPERNOVA REMNANT
    else if(uType == 4) {
      float filaments = ridge(q * 2.5 + vec3(uSeed * 3.0));
      float shell = smoothstep(0.1, 0.3, dist) * smoothstep(0.95, 0.6, dist);
      density = filaments * shell * circle * 0.7;
      density -= fbm(q * 2.0) * 0.15;
      density = max(density, 0.0);
      color = mix(uColor3, uColor2, filaments);
      color = mix(color, uColor1, smoothstep(0.3, 0.0, dist) * 0.4);
      color = mix(color, vec3(0.1, 1.0, 0.5), smoothstep(0.6, 0.9, filaments) * 0.4);
      color = mix(color, vec3(1.0, 0.2, 0.1), smoothstep(0.5, 0.8, n2) * 0.3);
      color += vec3(0.5, 0.8, 1.0) * v * 1.0 * circle;
    }
    
    color *= mix(0.3, 1.0, n1);
    
    float alpha = clamp(density * 1.5, 0.0, 1.0);
    if(alpha < 0.005) discard;
    
    gl_FragColor = vec4(color * density * 2.0, alpha);
  }
`;

const NEBULA_CONFIGS = {
  emission: {
    color1: '#ffe0f0',
    color2: '#ff3070',
    color3: '#4020aa',
    typeId: 0,
    glowColor: '#ff6090',
  },
  planetary: {
    color1: '#e0f8ff',
    color2: '#30c8ff',
    color3: '#1848a0',
    typeId: 1,
    glowColor: '#60ddff',
  },
  dark: {
    color1: '#1a0c10',
    color2: '#2a1018',
    color3: '#0a0608',
    typeId: 2,
    glowColor: '#664455',
  },
  reflection: {
    color1: '#c8e0ff',
    color2: '#3868cc',
    color3: '#142860',
    typeId: 3,
    glowColor: '#6088dd',
  },
  supernova_remnant: {
    color1: '#c0ffe8',
    color2: '#2898a0',
    color3: '#4838a8',
    typeId: 4,
    glowColor: '#80ccdd',
  },
};

export default function Nebula3D({ nebula, showLabels, onClick, isSelected, fov = 60 }) {
  const billboardRef = useRef();
  const position = useMemo(() => raDecTo3D(nebula.ra, nebula.dec, CELESTIAL_SPHERE_RADIUS * 0.97), [nebula.ra, nebula.dec]);
  
  const angularArcmin = nebula.size_arcmin || 10;
  const realSize = angularSizeToScene(angularArcmin, fov);
  const size = Math.max(0.25, realSize);
  
  const config = NEBULA_CONFIGS[nebula.type] || NEBULA_CONFIGS.emission;
  
  const seed = useMemo(() => {
    let h = 0;
    const id = nebula.id || nebula.name || '';
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return (Math.abs(h) % 1000) / 100;
  }, [nebula.id, nebula.name]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(config.color1) },
        uColor2: { value: new THREE.Color(config.color2) },
        uColor3: { value: new THREE.Color(config.color3) },
        uType: { value: config.typeId },
        uSeed: { value: seed },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [config, seed]);
  
  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime * 0.3;
    if (billboardRef.current) {
      const parentWorldQuat = new THREE.Quaternion();
      billboardRef.current.parent.getWorldQuaternion(parentWorldQuat);
      billboardRef.current.quaternion.copy(parentWorldQuat.invert().multiply(camera.quaternion));
    }
  });
  
  return (
    <group position={position}>
      <mesh
        ref={billboardRef}
        material={material}
        scale={[size, size, 1]}
        onClick={(e) => { e.stopPropagation(); onClick && onClick(nebula); }}
      >
        <planeGeometry args={[2, 2]} />
      </mesh>
      
      {showLabels && size > 0.15 && (
        <Html zIndexRange={[1, 0]} position={[size * 0.8, size * 0.6, 0]} style={{
          color: config.glowColor,
          fontSize: `${10 + (60-fov)/10}px`,
          fontFamily: 'Exo 2, sans-serif',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          textShadow: `0 0 8px ${config.glowColor}`,
        }}>
          {nebula.name}
        </Html>
      )}
      
      {isSelected && (
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <ringGeometry args={[size * 1.2, size * 1.4, 32]} />
          <meshBasicMaterial color={config.glowColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}