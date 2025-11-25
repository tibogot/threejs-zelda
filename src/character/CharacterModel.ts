import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export interface CharacterModelParams {
  modelPath?: string;
  scale?: number;
  yPosition?: number;
}

export class CharacterModel {
  private model: THREE.Group | null = null; // Root model group (added to scene)
  private animationGroup: THREE.Group | null = null; // Wrapper group with yPosition offset (matches original)
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentAnimation: string = "idle"; // Track current animation name
  private scene: THREE.Scene;
  private scale: number;
  private yPosition: number;
  private leftFootBone: THREE.Object3D | null = null;
  private rightFootBone: THREE.Object3D | null = null;
  private nodes: { [key: string]: THREE.Object3D } = {};

  constructor(
    scene: THREE.Scene,
    params: CharacterModelParams = {}
  ) {
    this.scene = scene;
    this.scale = params.scale ?? 1;
    this.yPosition = params.yPosition ?? -0.99;
  }

  async load(modelPath: string = "/models/AnimationLibrary_Godot_Standard-transformed.glb"): Promise<void> {
    return new Promise((resolve, reject) => {
      // Setup DRACO loader for compressed models
      const dracoLoader = new DRACOLoader();
      // Use CDN for draco decoder (works with Vite)
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      
      loader.load(
        modelPath,
        (gltf) => {
          // Clone the scene properly with skeleton
          const clone = SkeletonUtils.clone(gltf.scene);
          
          // Create root model group (this is what gets added to scene and positioned by physics)
          this.model = new THREE.Group();
          this.model.position.set(0, 0, 0);
          
          // Create animation group wrapper (matches original: <group ref={animationGroup} position={[0, yPosition, 0]}>)
          this.animationGroup = new THREE.Group();
          this.animationGroup.position.set(0, this.yPosition, 0);
          this.animationGroup.scale.set(this.scale, this.scale, this.scale);
          
          // Put the cloned scene inside the animation group
          this.animationGroup.add(clone);

          // Enable shadows on all meshes
          clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Add animation group to root model
          this.model.add(this.animationGroup);

          // Create animation mixer (mixer needs the root of the animated hierarchy)
          // In the original, useAnimations uses animationGroup as root, so we use animationGroup here
          this.mixer = new THREE.AnimationMixer(this.animationGroup);

          // Store all animations
          gltf.animations.forEach((clip) => {
            const action = this.mixer!.clipAction(clip);
            this.animations.set(clip.name, action);
          });
          
          console.log("Animation mixer created with", this.animations.size, "animations");

          // Store all nodes for bone lookup
          clone.traverse((child) => {
            this.nodes[child.name] = child;
          });

          // Find foot bones
          this.findFootBones();

          // Add to scene
          this.scene.add(this.model);

          console.log("Character model loaded:", {
            animations: Array.from(this.animations.keys()),
            scale: this.scale,
          });

          // Animation mapping - map our animation names to Godot animation names (matches original)
          const animationMap: { [key: string]: string } = {
            idle: "Idle_Loop",
            walk: "Walk_Loop",
            run: "Sprint_Loop",
            walkBackwards: "Walk_Loop",
            leftTurn: "Walk_Loop",
            rightTurn: "Walk_Loop",
            dance: "Dance_Loop",
            jumpStart: "Jump_Start",
            jumpLoop: "Jump_Loop",
            jumpLand: "Jump_Land",
            crouchIdle: "Crouch_Idle_Loop",
            crouchWalk: "Crouch_Fwd_Loop",
            swordIdle: "Sword_Idle",
            swordAttack: "Sword_Attack",
            swordAttackAlt: "Sword_Attack_RM",
            roll: "Roll",
          };

          // Play idle animation by default using mapped name
          const mappedIdle = animationMap.idle || "Idle_Loop";
          if (this.animations.has(mappedIdle)) {
            const action = this.animations.get(mappedIdle)!;
            action.reset().fadeIn(0).play();
            this.currentAction = action;
            this.currentAnimation = "idle"; // Store our internal name
            console.log("Playing idle animation:", mappedIdle);
          } else {
            // Fallback: try to find any idle animation
            const idleAnimations = ["Idle_Loop", "idle", "Idle", "IDLE"];
            let defaultAnimation = idleAnimations.find((name) =>
              this.animations.has(name)
            );
            if (!defaultAnimation && this.animations.size > 0) {
              defaultAnimation = Array.from(this.animations.keys())[0];
            }
            if (defaultAnimation) {
              const action = this.animations.get(defaultAnimation)!;
              action.reset().fadeIn(0).play();
              this.currentAction = action;
              this.currentAnimation = "idle";
              console.log("Playing fallback animation:", defaultAnimation);
            }
          }
          
          // Store animation map for later use
          (this as any).animationMap = animationMap;

          resolve();
        },
        undefined,
        (error) => {
          console.error("Error loading character model:", error);
          reject(error);
        }
      );
    });
  }

  playAnimation(name: string, fadeIn: number = 0.3, loop: boolean = true): void {
    const action = this.animations.get(name);
    if (!action) {
      console.warn(`Animation "${name}" not found`);
      return;
    }

    if (this.currentAction === action) {
      return; // Already playing
    }

    // Fade out current animation
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeIn);
    }

    // Configure loop mode
    if (loop) {
      action.setLoop(THREE.LoopRepeat);
    } else {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }

    // Fade in new animation
    action.reset().fadeIn(fadeIn).play();
    this.currentAction = action;
  }

  update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  getModel(): THREE.Group | null {
    return this.model;
  }

  getRotation(): number {
    if (this.model) {
      return this.model.rotation.y;
    }
    return 0;
  }

  getAvailableAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  setPosition(x: number, y: number, z: number): void {
    if (this.model) {
      this.model.position.set(x, y, z);
    }
  }

  setRotation(y: number): void {
    if (this.model) {
      this.model.rotation.y = y;
    }
  }

  setYPosition(y: number): void {
    this.yPosition = y;
    if (this.animationGroup) {
      // Update the animation group's y position (matches original structure)
      this.animationGroup.position.y = y;
    }
  }

  setScale(scale: number): void {
    this.scale = scale;
    if (this.animationGroup) {
      this.animationGroup.scale.set(scale, scale, scale);
    }
  }

  getYPosition(): number {
    return this.yPosition;
  }

  private findFootBones(): void {
    const findBoneByCandidates = (candidates: string[]): THREE.Object3D | null => {
      // Try direct name matches first
      for (const candidate of candidates) {
        const directMatch = this.nodes[candidate];
        if (directMatch) {
          return directMatch;
        }
      }

      // Try case-insensitive partial matches
      const lowerCandidates = candidates.map((name) => name.toLowerCase());
      for (const nodeName in this.nodes) {
        const node = this.nodes[nodeName];
        if (!node || typeof node !== "object") continue;
        if (!("isBone" in node) || !node.isBone) continue;
        
        const lowerNodeName = nodeName.toLowerCase();
        for (const candidate of lowerCandidates) {
          if (lowerNodeName.includes(candidate.toLowerCase())) {
            return node;
          }
        }
      }
      return null;
    };

    const leftFootCandidates = [
      "mixamorigLeftFoot",
      "mixamorig_LeftFoot",
      "LeftFoot",
      "DEF-footL",
    ];
    const rightFootCandidates = [
      "mixamorigRightFoot",
      "mixamorig_RightFoot",
      "RightFoot",
      "DEF-footR",
    ];

    this.leftFootBone = findBoneByCandidates(leftFootCandidates);
    this.rightFootBone = findBoneByCandidates(rightFootCandidates);

    if (this.leftFootBone || this.rightFootBone) {
      console.log("Foot bones found:", {
        leftFoot: this.leftFootBone?.name || "not found",
        rightFoot: this.rightFootBone?.name || "not found",
      });
    } else {
      console.warn("No foot bones detected in character model");
    }
  }

  getLeftFootBone(): THREE.Object3D | null {
    return this.leftFootBone;
  }

  getRightFootBone(): THREE.Object3D | null {
    return this.rightFootBone;
  }

  dispose(): void {
    if (this.model) {
      this.scene.remove(this.model);
      // Dispose animations
      this.animations.forEach((action) => {
        action.stop();
      });
      this.animations.clear();
      this.model = null;
    }
    if (this.mixer) {
      this.mixer = null;
    }
  }
}
