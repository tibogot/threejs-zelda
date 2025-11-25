import * as THREE from "three";

type RAPIER = Awaited<typeof import("@dimforge/rapier3d")>;

export class RapierDebugRenderer {
  private scene: THREE.Scene;
  private lines: THREE.LineSegments;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private enabled: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create geometry for debug lines
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      vertexColors: true,
    });

    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.visible = false;
    this.scene.add(this.lines);
  }

  update(world: InstanceType<RAPIER["World"]>): void {
    if (!this.enabled) return;

    try {
      const { vertices, colors } = world.debugRender();

      if (vertices.length === 0) {
        this.lines.visible = false;
        return;
      }

      // Vertices come as [x1, y1, z1, x2, y2, z2, ...] for line segments
      // We need to convert to pairs for LineSegments
      const positions = new Float32Array(vertices);
      this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      // Colors come as RGBA per vertex
      // For LineSegments, we need colors for each vertex
      const colorArray = new Float32Array((vertices.length / 3) * 3);
      for (let i = 0; i < colors.length; i += 4) {
        const vertexIndex = Math.floor(i / 4);
        if (vertexIndex * 3 + 2 < colorArray.length) {
          colorArray[vertexIndex * 3] = colors[i]; // R
          colorArray[vertexIndex * 3 + 1] = colors[i + 1]; // G
          colorArray[vertexIndex * 3 + 2] = colors[i + 2]; // B
        }
      }
      this.geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
      this.geometry.computeBoundingSphere();

      this.lines.visible = true;
    } catch (error) {
      console.warn("Rapier debug render error:", error);
      this.lines.visible = false;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.lines.visible = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    this.scene.remove(this.lines);
    this.geometry.dispose();
    this.material.dispose();
  }
}
