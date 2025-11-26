import * as THREE from "three";

export interface FootstepParticleSpawnOptions {
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  slopeFactor?: number;
}

const MAX_PARTICLES = 48;
const PARTICLE_LIFETIME = 0.45;

export class FootstepParticles {
  private group: THREE.Group;
  private sprites: THREE.Sprite[] = [];
  private velocities: THREE.Vector3[] = [];
  private lifetimes: Float32Array;
  private initialScales: Float32Array;
  private active: boolean[];
  private cursor: number = 0;
  private texture: THREE.CanvasTexture;
  private baseMaterial: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.lifetimes = new Float32Array(MAX_PARTICLES);
    this.initialScales = new Float32Array(MAX_PARTICLES);
    this.active = Array(MAX_PARTICLES).fill(false);

    // Create texture
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.15,
        size / 2,
        size / 2,
        size * 0.5
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.7)");
      gradient.addColorStop(0.4, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
    this.texture = new THREE.CanvasTexture(canvas);
    if ("encoding" in this.texture && "sRGBEncoding" in THREE) {
      (this.texture as any).encoding = (THREE as any).sRGBEncoding;
    }
    this.texture.needsUpdate = true;

    // Create base material
    this.baseMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    // Create sprites
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const material = this.baseMaterial.clone();
      material.opacity = 0;
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.setScalar(0.1);
      this.group.add(sprite);
      this.sprites[i] = sprite;
      this.velocities[i] = new THREE.Vector3();
    }
  }

  spawn(options: FootstepParticleSpawnOptions) {
    if (this.sprites.length === 0) {
      return;
    }

    const index = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;

    const sprite = this.sprites[index];
    const velocity = this.velocities[index];

    if (!sprite || !velocity) {
      return;
    }

    sprite.visible = true;
    sprite.position.copy(options.position);

    const up =
      options.normal && options.normal.lengthSq() > 0
        ? options.normal.clone()
        : undefined;
    const slopeFactor = options.slopeFactor ?? 0;
    const lateralStrength = THREE.MathUtils.lerp(0.4, 1.1, slopeFactor);
    const upwardStrength = THREE.MathUtils.lerp(0.55, 0.8, 1 - slopeFactor);

    const randomDir = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    )
      .normalize()
      .multiplyScalar(0.25 + Math.random() * 0.45);

    velocity.copy(randomDir).multiplyScalar(lateralStrength);

    if (up) {
      const upward = up.clone().multiplyScalar(upwardStrength);
      velocity.add(upward);
    } else {
      velocity.y += upwardStrength;
    }

    this.lifetimes[index] = PARTICLE_LIFETIME;
    const initialScale = 0.35 + Math.random() * 0.2;
    this.initialScales[index] = initialScale;
    sprite.scale.setScalar(initialScale);

    const material = sprite.material as THREE.SpriteMaterial;
    material.opacity = 0.55;
    this.active[index] = true;
  }

  update(delta: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.active[i]) continue;

      this.lifetimes[i] -= delta;

      const sprite = this.sprites[i];
      const velocity = this.velocities[i];

      if (!sprite || !velocity) continue;

      if (this.lifetimes[i] <= 0) {
        sprite.visible = false;
        this.active[i] = false;
        const material = sprite.material as THREE.SpriteMaterial;
        material.opacity = 0;
        continue;
      }

      sprite.position.addScaledVector(velocity, delta);
      velocity.multiplyScalar(0.84);

      const t = this.lifetimes[i] / PARTICLE_LIFETIME;
      const baseScale = this.initialScales[i];
      const currentScale = baseScale * (1 + (1 - t) * 0.45);
      sprite.scale.setScalar(currentScale);

      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = 0.55 * Math.pow(t, 0.6);
    }
  }

  dispose() {
    this.sprites.forEach((sprite) => {
      if (sprite.material) {
        sprite.material.dispose();
      }
      this.group.remove(sprite);
    });
    this.sprites = [];
    this.texture.dispose();
    this.baseMaterial.dispose();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

