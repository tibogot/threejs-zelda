export interface KeyboardState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
  crouch: boolean;
  dance: boolean;
  walkBackward: boolean;
  roll: boolean;
}

export class KeyboardManager {
  private keys: Map<string, boolean> = new Map();
  private state: KeyboardState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    crouch: false,
    dance: false,
    walkBackward: false,
    roll: false,
  };

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener("keydown", (event) => {
      // Prevent default for Space to avoid page scrolling
      if (event.code === "Space") {
        event.preventDefault();
      }
      this.keys.set(event.code, true);
      this.updateState();
    });

    window.addEventListener("keyup", (event) => {
      // Prevent default for Space to avoid page scrolling
      if (event.code === "Space") {
        event.preventDefault();
      }
      this.keys.set(event.code, false);
      this.updateState();
    });
  }

  private updateState(): void {
    this.state.forward =
      this.keys.get("KeyW") === true || this.keys.get("ArrowUp") === true;
    this.state.backward =
      this.keys.get("KeyS") === true || this.keys.get("ArrowDown") === true;
    this.state.left =
      this.keys.get("KeyA") === true || this.keys.get("ArrowLeft") === true;
    this.state.right =
      this.keys.get("KeyD") === true || this.keys.get("ArrowRight") === true;
    this.state.run = this.keys.get("ShiftLeft") === true || this.keys.get("ShiftRight") === true;
    this.state.jump = this.keys.get("Space") === true;
    this.state.crouch =
      this.keys.get("ControlLeft") === true || this.keys.get("ControlRight") === true;
    this.state.dance = this.keys.get("KeyE") === true;
    this.state.walkBackward = this.keys.get("KeyQ") === true;
    this.state.roll = this.keys.get("KeyF") === true;
  }

  getState(): KeyboardState {
    return { ...this.state };
  }

  isKeyPressed(code: string): boolean {
    return this.keys.get(code) === true;
  }

  dispose(): void {
    // Event listeners will be cleaned up automatically
    this.keys.clear();
  }
}
