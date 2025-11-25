type RAPIER = Awaited<typeof import("@dimforge/rapier3d")>;

export class PhysicsManager {
  private RAPIER: RAPIER | null = null;
  private world: InstanceType<RAPIER["World"]> | null = null;
  private initialized: boolean = false;
  private fixedTimeStep: number = 1 / 60; // 60hz physics
  private accumulator: number = 0;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Dynamically import Rapier (required for bundlers like Vite)
    this.RAPIER = await import("@dimforge/rapier3d");

    // Create physics world with gravity
    this.world = new this.RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

    this.initialized = true;
    console.log("PhysicsManager initialized");
  }

  getWorld(): InstanceType<RAPIER["World"]> {
    if (!this.world || !this.RAPIER) {
      throw new Error("PhysicsManager not initialized. Call init() first.");
    }
    return this.world;
  }

  getRAPIER(): RAPIER {
    if (!this.RAPIER) {
      throw new Error("PhysicsManager not initialized. Call init() first.");
    }
    return this.RAPIER;
  }

  /**
   * Step physics with fixed timestep (60hz)
   * Returns the interpolation alpha (0-1) for smooth rendering between physics steps
   */
  step(deltaTime: number): number {
    if (!this.world) {
      return 0;
    }

    // Clamp deltaTime to prevent large jumps
    const clampedDelta = Math.min(deltaTime, 0.25);
    
    // Add to accumulator
    this.accumulator += clampedDelta;

    // Step physics at fixed timestep (60hz)
    // Rapier.js step() doesn't take timestep - it uses internal timestep
    // We control fixed timestep by calling step() multiple times based on accumulator
    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep) {
      // Call step() without parameters - Rapier uses its internal timestep
      // We've already configured the world, so this should work
      this.world.step();
      this.accumulator -= this.fixedTimeStep;
      steps++;
      
      // Safety: prevent too many steps in one frame (spiral of death protection)
      if (steps > 10) {
        console.warn("Physics step limit reached, clamping accumulator");
        this.accumulator = 0;
        break;
      }
    }

    // Return interpolation alpha (0-1) for smooth rendering
    // Alpha represents how far we are between the last physics step and the next one
    return this.accumulator / this.fixedTimeStep;
  }

  dispose(): void {
    if (this.world) {
      // Rapier doesn't have explicit dispose, but we can clear references
      this.world = null;
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
