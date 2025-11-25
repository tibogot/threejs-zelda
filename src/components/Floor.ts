import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TILE_REFERENCE_SCALE } from "./tileMaterialConfig";

type RAPIER = Awaited<typeof import("@dimforge/rapier3d")>;

export interface FloorParams {
  size?: number;
  position?: [number, number, number];
  textureScale?: number;
  onTerrainReady?: () => void;
}

export class Floor {
  private mesh: THREE.Mesh;
  private tileMaterial: TileMaterial;
  private rigidBody: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private onTerrainReady?: () => void;

  constructor(params: FloorParams = {}) {
    const {
      size = 200,
      position = [0, 0, 0],
      textureScale = TILE_REFERENCE_SCALE,
      onTerrainReady,
    } = params;

    this.onTerrainReady = onTerrainReady;

    // Create floor geometry (plane rotated to be horizontal)
    const geometry = new THREE.PlaneGeometry(size, size);
    this.tileMaterial = new TileMaterial({
      textureScale,
      gradientIntensity: 0.5,
      gradientBias: 0.0,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.tileMaterial.getMaterial());
    this.mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.mesh.position.set(position[0], position[1], position[2]);
    this.mesh.receiveShadow = true;
  }

  /**
   * Add physics collider to the floor
   * Must be called after PhysicsManager is initialized
   */
  addPhysics(RAPIER: RAPIER, world: InstanceType<RAPIER["World"]>, onTerrainReady?: () => void): void {
    if (this.rigidBody || this.collider) {
      console.warn("Floor physics already added");
      return;
    }

    // Create fixed rigid body for the floor
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(
        this.mesh.position.x,
        this.mesh.position.y,
        this.mesh.position.z
      );

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    // Create cuboid collider for the floor (plane as a thin box)
    const halfSize = (this.mesh.geometry as THREE.PlaneGeometry).parameters.width / 2;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, 0.1, halfSize)
      .setRotation({ w: 1, x: 0, y: 0, z: 0 }); // Floor is horizontal

    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    console.log("Floor physics added");

    // Call onTerrainReady after a short delay to ensure physics are initialized
    const callback = onTerrainReady || this.onTerrainReady;
    if (callback) {
      setTimeout(() => {
        callback();
      }, 300);
    }
  }

  getRigidBody(): InstanceType<RAPIER["RigidBody"]> | null {
    return this.rigidBody;
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  getTileMaterial(): TileMaterial {
    return this.tileMaterial;
  }

  setTextureScale(scale: number): void {
    this.tileMaterial.setTextureScale(scale);
  }

  setGradientIntensity(intensity: number): void {
    this.tileMaterial.setGradientIntensity(intensity);
  }

  setGradientBias(bias: number): void {
    this.tileMaterial.setGradientBias(bias);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.tileMaterial.dispose();
  }
}
