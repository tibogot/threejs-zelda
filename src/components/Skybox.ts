import * as THREE from "three";

export class Skybox {
  private mesh: THREE.Mesh;
  private texture: THREE.CubeTexture | null = null;
  private material: THREE.ShaderMaterial;

  constructor() {
    // Load cube texture
    const loader = new THREE.CubeTextureLoader();
    this.texture = loader.load([
      "/textures/skybox/posx.jpg", // right
      "/textures/skybox/negx.jpg", // left
      "/textures/skybox/posy.jpg", // top
      "/textures/skybox/negy.jpg", // bottom
      "/textures/skybox/posz.jpg", // front
      "/textures/skybox/negz.jpg", // back
    ]);

    // Create geometry (large box to encompass the scene)
    const geometry = new THREE.BoxGeometry(5000, 5000, 5000);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        skybox: { value: this.texture },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube skybox;
        varying vec3 vWorldPosition;
        
        void main() {
          gl_FragColor = texture(skybox, normalize(vWorldPosition));
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  isVisible(): boolean {
    return this.mesh.visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.texture) {
      this.texture.dispose();
    }
  }
}
