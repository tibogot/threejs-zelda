import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TILE_DENSITY } from "./tileMaterialConfig";

type RAPIER = Awaited<typeof import("@dimforge/rapier3d")>;

export interface BuildingParams {
  scale?: number;
  position?: [number, number, number];
  width?: number;
  height?: number;
  depth?: number;
}

export class Building {
  private mesh: THREE.Mesh;
  private tileMaterial: TileMaterial;
  private geometry: THREE.BoxGeometry;
  private rigidBody: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;

  constructor(params: BuildingParams = {}) {
    const {
      scale = 1,
      position = [0, 0, 0],
      width = 18,
      height = 60,
      depth = 14,
    } = params;

    // Create building geometry
    const buildingWidth = width * scale;
    const buildingHeight = height * scale;
    const buildingDepth = depth * scale;
    this.geometry = new THREE.BoxGeometry(
      buildingWidth,
      buildingHeight,
      buildingDepth
    );

    // Setup UV mapping for tile material (same as Map1.jsx)
    const tileSize = 1 / TILE_DENSITY;
    const positionAttr = this.geometry.attributes.position;
    const normalAttr = this.geometry.attributes.normal;
    const uvAttr = this.geometry.attributes.uv;

    const positionVector = new THREE.Vector3();
    const normalVector = new THREE.Vector3();

    for (let i = 0; i < uvAttr.count; i++) {
      positionVector.fromBufferAttribute(positionAttr, i);
      normalVector.fromBufferAttribute(normalAttr, i);

      const absNormalX = Math.abs(normalVector.x);
      const absNormalY = Math.abs(normalVector.y);
      const absNormalZ = Math.abs(normalVector.z);

      if (absNormalX >= absNormalY && absNormalX >= absNormalZ) {
        // X-facing face
        const u = (positionVector.z + buildingDepth * 0.5) / tileSize;
        const v = (positionVector.y + buildingHeight * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else if (absNormalY >= absNormalX && absNormalY >= absNormalZ) {
        // Y-facing face (top/bottom)
        const u = (positionVector.x + buildingWidth * 0.5) / tileSize;
        const v = (positionVector.z + buildingDepth * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else {
        // Z-facing face
        const u = (positionVector.x + buildingWidth * 0.5) / tileSize;
        const v = (positionVector.y + buildingHeight * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      }
    }

    uvAttr.needsUpdate = true;

    // Create tile material
    this.tileMaterial = new TileMaterial({
      textureScale: TILE_DENSITY,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.tileMaterial.getMaterial());
    this.mesh.position.set(position[0], position[1], position[2]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  /**
   * Add physics collider to the building
   * Must be called after PhysicsManager is initialized
   */
  addPhysics(RAPIER: RAPIER, world: InstanceType<RAPIER["World"]>): void {
    if (this.rigidBody || this.collider) {
      console.warn("Building physics already added");
      return;
    }

    // Get building dimensions
    const width = this.geometry.parameters.width;
    const height = this.geometry.parameters.height;
    const depth = this.geometry.parameters.depth;

    // Create fixed rigid body for the building
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      this.mesh.position.x,
      this.mesh.position.y,
      this.mesh.position.z
    );

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    // Create cuboid collider for the building
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      width / 2,
      height / 2,
      depth / 2
    )
      .setFriction(1)
      .setRestitution(0);

    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    console.log("Building physics added");
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

  dispose(): void {
    this.geometry.dispose();
    this.tileMaterial.dispose();
  }
}

