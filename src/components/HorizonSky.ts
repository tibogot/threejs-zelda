import * as THREE from "three";

export interface HorizonSkyParams {
  topColor?: string;
  bottomColor?: string;
  offset?: number;
  exponent?: number;
  radius?: number;
}

export class HorizonSky {
  private mesh: THREE.Mesh;
  private uniforms: {
    topColor: { value: THREE.Color };
    bottomColor: { value: THREE.Color };
    offset: { value: number };
    exponent: { value: number };
  };

  constructor(params: HorizonSkyParams = {}) {
    const {
      topColor = "#0077ff",
      bottomColor = "#ffffff",
      offset = 33,
      exponent = 0.6,
      radius = 4000,
    } = params;

    // Create uniforms
    this.uniforms = {
      topColor: { value: new THREE.Color(topColor) },
      bottomColor: { value: new THREE.Color(bottomColor) },
      offset: { value: offset },
      exponent: { value: exponent },
    };

    // Vertex shader
    const vertexShader = `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment shader
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;

      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition + vec3(offset)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `;

    // Create geometry and material
    const geometry = new THREE.SphereGeometry(radius, 32, 15);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  // Update methods for dynamic control
  setTopColor(color: string): void {
    this.uniforms.topColor.value.set(color);
  }

  setBottomColor(color: string): void {
    this.uniforms.bottomColor.value.set(color);
  }

  setOffset(offset: number): void {
    this.uniforms.offset.value = offset;
  }

  setExponent(exponent: number): void {
    this.uniforms.exponent.value = exponent;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.ShaderMaterial).dispose();
  }
}
