import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

export interface TileMaterialParams {
  textureScale?: number;
  gradientIntensity?: number;
  gradientBias?: number;
}

// Shared texture instance to avoid multiple loads
let sharedTexture: THREE.Texture | null = null;

export class TileMaterial {
  private material: CustomShaderMaterial<typeof THREE.MeshStandardMaterial>;
  private uniforms: {
    gridTexture: { value: THREE.Texture | null };
    gradientIntensity: { value: number };
    textureScale: { value: number };
    gradientBias: { value: number };
  };

  constructor(params: TileMaterialParams = {}) {
    const {
      textureScale = 1.0,
      gradientIntensity = 0.5,
      gradientBias = 0.0,
    } = params;

    // Load grid texture (shared instance)
    if (!sharedTexture) {
      const loader = new THREE.TextureLoader();
      sharedTexture = loader.load("/textures/grid.png");
      sharedTexture.wrapS = THREE.RepeatWrapping;
      sharedTexture.wrapT = THREE.RepeatWrapping;
      sharedTexture.anisotropy = 16;
    }

    // Create uniforms
    this.uniforms = {
      gridTexture: { value: sharedTexture },
      gradientIntensity: { value: gradientIntensity },
      textureScale: { value: textureScale },
      gradientBias: { value: gradientBias },
    };

    // Vertex shader
    const vertexShader = `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
      }
    `;

    // Fragment shader
    const fragmentShader = `
      uniform sampler2D gridTexture;
      uniform float gradientIntensity;
      uniform float textureScale;
      uniform float gradientBias;
      varying vec2 vUv;
      
      float hash12(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float remap(float value, float oldMin, float oldMax, float newMin, float newMax) {
        return newMin + (value - oldMin) * (newMax - newMin) / (oldMax - oldMin);
      }
      
      void main() {
        // Use standard UV coordinates like default Three.js materials
        vec2 objectUV = vUv * textureScale;
        
        float grid1 = texture2D(gridTexture, objectUV * 0.125).r;
        float grid2 = texture2D(gridTexture, objectUV * 1.25).r;
        
        float gridHash1 = hash12(floor(objectUV * 1.25));
        
        float variationAmount = gradientIntensity * 0.2;
        
        float baseShade = clamp(
          0.45 + remap(gridHash1, 0.0, 1.0, -variationAmount, variationAmount) + gradientBias,
          0.0,
          1.0
        );

        vec3 gridColour = mix(
          vec3(baseShade), 
          vec3(0.08), 
          grid2
        );
        gridColour = mix(gridColour, vec3(0.0), grid1);
        
        csm_DiffuseColor = vec4(gridColour, 1.0);
      }
    `;

    // Create the custom shader material
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      roughness: 1.0,
      metalness: 0.0,
    });
  }

  getMaterial(): CustomShaderMaterial<typeof THREE.MeshStandardMaterial> {
    return this.material;
  }

  setTextureScale(scale: number): void {
    this.uniforms.textureScale.value = scale;
  }

  setGradientIntensity(intensity: number): void {
    this.uniforms.gradientIntensity.value = intensity;
  }

  setGradientBias(bias: number): void {
    this.uniforms.gradientBias.value = bias;
  }

  dispose(): void {
    this.material.dispose();
  }
}
