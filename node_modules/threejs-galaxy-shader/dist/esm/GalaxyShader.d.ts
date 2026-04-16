import * as THREE from "three";
type GalaxyShaderParams = {
    resolution?: THREE.Vector2;
    color?: THREE.Color;
    pointSize?: number;
    totalStars?: number;
    time?: number;
    blackHoleRadius?: number;
    blackHolePosition?: THREE.Vector3;
    spiralCount?: number;
    turnsPerSpiral?: number;
    fadeNear?: number;
    fadeFar?: number;
    colorMode?: number;
    colorPalette?: THREE.Color[];
    colorIntensity?: number;
};
export declare class GalaxyShader extends THREE.ShaderMaterial {
    constructor(params?: GalaxyShaderParams);
}
export {};
//# sourceMappingURL=GalaxyShader.d.ts.map