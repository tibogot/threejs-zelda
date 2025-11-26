// CharacterController.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { FootstepParticles } from "../effects/FootstepParticles";

export class CharacterController {
  constructor(scene, world, camera, collider = null, rapierInstance = null) {
    if (!rapierInstance) {
      throw new Error(
        "CharacterController requires a RAPIER instance to be passed. Use PhysicsManager.getRAPIER()"
      );
    }

    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.collider = collider; // BVH mesh for ground detection
    this.rapierInstance = rapierInstance; // Use provided RAPIER instance from PhysicsManager

    // Configuration
    this.config = {
      WALK_SPEED: 1.8,
      RUN_SPEED: 4,
      ROTATION_SPEED: THREE.MathUtils.degToRad(0.5),
      JUMP_FORCE: 6,
      cameraX: 0,
      cameraY: 1.5,
      cameraZ: -5.6,
      targetZ: 5,
      cameraLerpSpeed: 0.1,
      mouseSensitivity: 0.003,
      capsuleHeight: 1.4,
      capsuleRadius: 0.3,
      yPosition: -0.99,
      characterScale: 1,
      enableFootstepAudio: true,
      enableFootstepParticles: true,
    };

    // Physics body
    this.rigidBody = null;
    this.colliderDesc = null;
    this.collider = null; // Store collider handle for dynamic updates
    this.currentCapsuleHalfHeight = this.config.capsuleHeight / 2; // Track current capsule half height
    this.currentCharacterYOffset = this.config.yPosition; // Track current character model Y offset

    // Interpolation for smooth rendering
    this.prevPosition = new THREE.Vector3();
    this.currentPosition = new THREE.Vector3();

    // Character groups
    this.container = new THREE.Group();
    this.character = new THREE.Group();
    this.animationGroup = new THREE.Group();
    this.cameraTarget = new THREE.Group();
    this.cameraPosition = new THREE.Group();

    // Setup hierarchy
    this.character.add(this.animationGroup);
    this.container.add(this.character);
    this.container.add(this.cameraTarget);
    this.container.add(this.cameraPosition);
    this.scene.add(this.container);

    // Position camera helpers
    this.cameraTarget.position.z = this.config.targetZ;
    this.cameraPosition.position.set(
      this.config.cameraX,
      this.config.cameraY,
      this.config.cameraZ
    );

    // Animation
    this.mixer = null;
    this.actions = {};
    this.currentAnimation = "idle";
    this.currentAction = null;
    this.animationChangeCooldown = 0;

    // State
    this.isGrounded = true;
    this.wasGrounded = false;
    this.jumpPhase = "none"; // 'none' | 'start' | 'loop' | 'land'
    this.combatMode = false;
    this.isAttacking = false;
    this.isRolling = false;
    this.isCrouching = false;
    this.crouchTransitioning = false;
    this.ceilingClearanceTimer = -1;
    this.rollDirection = undefined;
    this.rollSpeed = undefined;

    // Rotation
    this.characterRotationTarget = 0;
    this.rotationTarget = 0;

    // Camera
    this.cameraMode = "follow-orbit"; // 'follow' | 'follow-orbit' | 'orbit'
    this.cameraWorldPosition = new THREE.Vector3();
    this.cameraLookAtWorldPosition = new THREE.Vector3();
    this.cameraLookAt = new THREE.Vector3();
    this.cameraInitialized = false;
    this.mouseOrbitOffset = 0;
    this.mouseVerticalOffset = 0;
    this.isPointerLocked = false;

    // Input
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      jump: false,
      crouch: false,
      dance: false,
      roll: false,
      walkBackward: false,
    };
    this.jumpPressed = false;
    this.rollPressed = false;

    // Footstep system
    this.leftFootBone = null;
    this.rightFootBone = null;
    this.leftFootWorldPosition = new THREE.Vector3();
    this.rightFootWorldPosition = new THREE.Vector3();
    this.prevLeftFootPosition = new THREE.Vector3();
    this.prevRightFootPosition = new THREE.Vector3();
    this.leftFootInitialized = false;
    this.rightFootInitialized = false;
    this.leftFootWasGrounded = false;
    this.rightFootWasGrounded = false;
    this.footstepCooldown = 0;
    this.lastFootstepIndex = null;
    this.leftFootPrevToi = 1;
    this.rightFootPrevToi = 1;

    // Footstep particles
    this.footstepParticles = null;

    this.footstepAnimations = new Set([
      "walk",
      "run",
      "walkBackwards",
      "crouchWalk",
    ]);
    this.footstepSoundPaths = [
      "/sounds/steps.mp3",
      "/sounds/steps (2).mp3",
      "/sounds/steps (3).mp3",
      "/sounds/steps (5).mp3",
    ];

    // BVH temps
    this.tempBox = new THREE.Box3();
    this.tempMat = new THREE.Matrix4();
    this.tempSegment = new THREE.Line3();
    this.tempVector = new THREE.Vector3();
    this.tempVector2 = new THREE.Vector3();
    this.tempLandingCenter = new THREE.Vector3();
    this.tempLandingNormal = new THREE.Vector3(0, 1, 0);

    // Animation mapping
    this.animationMap = {
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

    // Bind methods
    this.update = this.update.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handleClick = this.handleClick.bind(this);

    // Setup input listeners
    this.setupInputListeners();

    // Load model
    this.loadModel();
  }

  setupInputListeners() {
    // Keyboard
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    // Mouse
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("mousemove", this.handleMouseMove);

    // Pointer lock
    document.addEventListener(
      "pointerlockchange",
      this.handlePointerLockChange
    );

    // Canvas click for pointer lock
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("click", this.handleClick);
    }
  }

  handleClick() {
    if (this.cameraMode === "follow-orbit" && !this.isPointerLocked) {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        canvas.requestPointerLock();
      }
    }
  }

  handleKeyDown(e) {
    const key = e.key.toLowerCase();
    switch (key) {
      case "w":
      case "z":
      case "arrowup":
        this.keys.forward = true;
        break;
      case "s":
      case "arrowdown":
        this.keys.backward = true;
        break;
      case "a":
      case "q":
      case "arrowleft":
        this.keys.left = true;
        break;
      case "d":
      case "arrowright":
        this.keys.right = true;
        break;
      case "shift":
        this.keys.run = true;
        break;
      case " ":
        this.keys.jump = true;
        break;
      case "control":
        this.keys.crouch = true;
        break;
      case "e":
        this.keys.dance = true;
        break;
      case "alt":
      case "f":
        this.keys.roll = true;
        break;
      case "r":
        this.combatMode = !this.combatMode;
        break;
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    switch (key) {
      case "w":
      case "z":
      case "arrowup":
        this.keys.forward = false;
        break;
      case "s":
      case "arrowdown":
        this.keys.backward = false;
        break;
      case "a":
      case "q":
      case "arrowleft":
        this.keys.left = false;
        break;
      case "d":
      case "arrowright":
        this.keys.right = false;
        break;
      case "shift":
        this.keys.run = false;
        break;
      case " ":
        this.keys.jump = false;
        break;
      case "control":
        this.keys.crouch = false;
        break;
      case "e":
        this.keys.dance = false;
        break;
      case "alt":
      case "f":
        this.keys.roll = false;
        break;
    }
  }

  handleMouseDown(e) {
    if (!this.combatMode || this.isAttacking) return;

    this.isAttacking = true;

    if (e.button === 0) {
      this.setAnimation("swordAttack");
      setTimeout(() => {
        this.isAttacking = false;
      }, 600);
    } else if (e.button === 2) {
      this.setAnimation("swordAttackAlt");
      setTimeout(() => {
        this.isAttacking = false;
      }, 600);
    }
  }

  handleContextMenu(e) {
    if (this.combatMode) {
      e.preventDefault();
    }
  }

  handleMouseMove(e) {
    if (this.cameraMode !== "follow-orbit" || !this.isPointerLocked) return;

    const deltaX = e.movementX || 0;
    const deltaY = e.movementY || 0;

    this.mouseOrbitOffset -= deltaX * this.config.mouseSensitivity;
    this.mouseVerticalOffset -= deltaY * this.config.mouseSensitivity;

    this.mouseVerticalOffset = THREE.MathUtils.clamp(
      this.mouseVerticalOffset,
      -Math.PI / 3,
      Math.PI / 3
    );
  }

  handlePointerLockChange() {
    const canvas = document.querySelector("canvas");
    this.isPointerLocked = document.pointerLockElement === canvas;
    document.body.style.cursor = this.isPointerLocked ? "none" : "auto";
  }

  async loadModel() {
    // Setup DRACO loader for compressed models
    const dracoLoader = new DRACOLoader();
    // Use CDN for draco decoder (works with Vite)
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
    );

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    try {
      const gltf = await loader.loadAsync(
        "/models/AnimationLibrary_Godot_Standard-transformed.glb"
      );

      // Clone scene with skeleton
      const clonedScene = SkeletonUtils.clone(gltf.scene);

      // Find meshes and setup
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
        }
      });

      // Add to animation group
      this.animationGroup.add(clonedScene);
      this.animationGroup.position.y = this.config.yPosition;
      this.animationGroup.scale.setScalar(this.config.characterScale);

      // Setup animations
      this.mixer = new THREE.AnimationMixer(clonedScene);

      gltf.animations.forEach((clip) => {
        const action = this.mixer.clipAction(clip);
        this.actions[clip.name] = action;
      });

      // Find foot bones
      this.findFootBones(clonedScene);

      // Start with idle
      this.setAnimation("idle");

      // Initialize footstep particles
      if (this.config.enableFootstepParticles) {
        this.footstepParticles = new FootstepParticles(this.scene);
      }

      console.log("Character model loaded successfully");
    } catch (error) {
      console.error("Error loading character model:", error);
    }
  }

  findFootBones(scene) {
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

    scene.traverse((node) => {
      if (node.isBone) {
        const nameLower = node.name.toLowerCase();

        if (
          leftFootCandidates.some((c) => nameLower.includes(c.toLowerCase()))
        ) {
          this.leftFootBone = node;
        }
        if (
          rightFootCandidates.some((c) => nameLower.includes(c.toLowerCase()))
        ) {
          this.rightFootBone = node;
        }
      }
    });

    if (this.leftFootBone)
      console.log("Found left foot bone:", this.leftFootBone.name);
    if (this.rightFootBone)
      console.log("Found right foot bone:", this.rightFootBone.name);
  }

  setAnimation(animName) {
    if (this.currentAnimation === animName) return;

    // Prevent rapid animation switches (except for jump/land animations which need to be immediate)
    const priorityAnimations = ["jumpStart", "jumpLoop", "jumpLand", "roll"];
    const isPriority = priorityAnimations.includes(animName);

    if (!isPriority && this.animationChangeCooldown > 0) {
      return;
    }

    const mappedName = this.animationMap[animName] || this.animationMap.idle;
    const nextAction = this.actions[mappedName];

    if (!nextAction) {
      console.warn(`Animation ${mappedName} not found`);
      return;
    }

    if (this.currentAction) {
      this.currentAction.fadeOut(0.15);
    }

    nextAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(0.15)
      .play();

    this.currentAction = nextAction;
    this.currentAnimation = animName;

    // Set cooldown for non-priority animations
    if (!isPriority) {
      this.animationChangeCooldown = 0.1;
    }
  }

  createPhysicsBody(position = [0, 2, 0]) {
    if (!this.world) return;

    // Use the RAPIER instance (either passed in or imported)
    const RAPIER = this.rapierInstance;

    // Create rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...position)
      .setCanSleep(false)
      .setCcdEnabled(true);

    this.rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Initialize interpolation positions
    this.prevPosition.set(position[0], position[1], position[2]);
    this.currentPosition.set(position[0], position[1], position[2]);

    // Create capsule collider
    const halfHeight = this.config.capsuleHeight / 2;
    this.colliderDesc = RAPIER.ColliderDesc.capsule(
      halfHeight,
      this.config.capsuleRadius
    )
      .setFriction(0.5)
      .setRestitution(0);

    this.collider = this.world.createCollider(
      this.colliderDesc,
      this.rigidBody
    );

    // Lock rotations
    this.rigidBody.lockRotations(true, true);
  }

  updateCapsuleCollider(targetHalfHeight) {
    if (!this.rigidBody || !this.world || !this.collider) return;

    const RAPIER = this.rapierInstance;
    const currentPos = this.rigidBody.translation();
    const currentHalfHeight = this.currentCapsuleHalfHeight;

    // Only update if height actually changed
    if (Math.abs(currentHalfHeight - targetHalfHeight) < 0.01) return;

    // Remove old collider
    this.world.removeCollider(this.collider, true);

    // Create new collider with updated height
    this.colliderDesc = RAPIER.ColliderDesc.capsule(
      targetHalfHeight,
      this.config.capsuleRadius
    )
      .setFriction(0.5)
      .setRestitution(0);

    this.collider = this.world.createCollider(
      this.colliderDesc,
      this.rigidBody
    );

    // Update tracked height
    this.currentCapsuleHalfHeight = targetHalfHeight;

    // Adjust rigid body position to account for height change
    // Keep the bottom of the capsule at the same level
    // When capsule shrinks: old bottom = Y - currentHalfHeight, new bottom should be same
    // So new center = (Y - currentHalfHeight) + targetHalfHeight = Y - (currentHalfHeight - targetHalfHeight)
    // Therefore we move DOWN by (currentHalfHeight - targetHalfHeight)
    const heightDiff = currentHalfHeight - targetHalfHeight;
    this.rigidBody.setTranslation(
      {
        x: currentPos.x,
        y: currentPos.y - heightDiff, // Move DOWN when capsule shrinks
        z: currentPos.z,
      },
      true
    );

    // Adjust character model visual offset to match capsule height change
    // Since rigid body moves DOWN when capsule shrinks, character model needs to move UP
    // relative to capsule center to keep character's feet at the same ground level
    const heightChange = currentHalfHeight - targetHalfHeight;

    // When capsule shrinks (heightChange > 0), rigid body moves down, so character offset moves up
    // When capsule grows (heightChange < 0), rigid body moves up, so character offset moves down
    this.currentCharacterYOffset = this.currentCharacterYOffset + heightChange;

    if (this.animationGroup) {
      this.animationGroup.position.y = this.currentCharacterYOffset;
    }
  }

  checkGroundedRapier() {
    if (!this.rigidBody || !this.world) return false;

    const RAPIER = this.rapierInstance;
    const position = this.rigidBody.translation();

    // Use tracked current half height (updated by updateCapsuleCollider)
    const currentHalfHeight = this.currentCapsuleHalfHeight;

    const rayOrigin = {
      x: position.x,
      y: position.y - currentHalfHeight - this.config.capsuleRadius + 0.05,
      z: position.z,
    };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const rayLength = 0.2;

    const ray = new RAPIER.Ray(rayOrigin, rayDirection);
    const hit = this.world.castRay(
      ray,
      rayLength,
      true,
      undefined,
      undefined,
      undefined,
      this.rigidBody
    );

    if (hit) {
      const hitToi = hit.toi ?? hit.timeOfImpact ?? hit.time_of_impact;
      return typeof hitToi === "number" && hitToi <= rayLength;
    }

    return false;
  }

  checkCeilingClearance() {
    if (!this.rigidBody || !this.world) return true;

    const RAPIER = this.rapierInstance;
    const position = this.rigidBody.translation();
    const crouchHalfHeight = (this.config.capsuleHeight * 0.5) / 2;
    const standingHalfHeight = this.config.capsuleHeight / 2;

    const rayOrigin = {
      x: position.x,
      y: position.y + crouchHalfHeight + this.config.capsuleRadius,
      z: position.z,
    };
    const rayDirection = { x: 0, y: 1, z: 0 };
    const safetyBuffer = 0.5;
    const rayLength = standingHalfHeight - crouchHalfHeight + safetyBuffer;

    const ray = new RAPIER.Ray(rayOrigin, rayDirection);
    const hit = this.world.castRay(
      ray,
      rayLength,
      true,
      undefined,
      undefined,
      undefined,
      this.rigidBody
    );

    return !hit;
  }

  castFootRay(position) {
    if (!this.world || !this.rigidBody) return null;

    const RAPIER = this.rapierInstance;
    const rayOrigin = {
      x: position.x,
      y: position.y + 0.05,
      z: position.z,
    };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const rayLength = 0.35;

    try {
      const ray = new RAPIER.Ray(rayOrigin, rayDirection);
      const hit = this.world.castRayAndGetNormal(
        ray,
        rayLength,
        true,
        undefined,
        undefined,
        undefined,
        this.rigidBody
      );

      if (hit) {
        const hitToi = hit.toi ?? hit.timeOfImpact ?? hit.time_of_impact;

        if (typeof hitToi === "number" && hitToi <= rayLength) {
          const point = new THREE.Vector3(
            rayOrigin.x + rayDirection.x * hitToi,
            rayOrigin.y + rayDirection.y * hitToi,
            rayOrigin.z + rayDirection.z * hitToi
          );

          // Get normal for slope calculation
          const hitNormal = hit.normal ?? hit.normal1 ?? hit.normal2 ?? null;
          let normal = new THREE.Vector3(0, 1, 0);
          if (hitNormal) {
            normal.set(hitNormal.x, hitNormal.y, hitNormal.z);
          }

          const slopeFactor = 1 - Math.max(0, Math.min(1, normal.y));

          return {
            hitToi,
            slopeFactor,
            point,
            normal,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn("Footstep raycast error:", error);
      return null;
    }
  }

  playFootstepSound(volumeMultiplier = 1.0) {
    if (
      !this.config.enableFootstepAudio ||
      this.footstepSoundPaths.length === 0
    ) {
      return;
    }

    let chosenIndex;
    if (this.footstepSoundPaths.length === 1) {
      chosenIndex = 0;
    } else {
      let attempts = 0;
      do {
        chosenIndex = Math.floor(
          Math.random() * this.footstepSoundPaths.length
        );
        attempts++;
      } while (chosenIndex === this.lastFootstepIndex && attempts < 5);
    }

    this.lastFootstepIndex = chosenIndex;
    const audio = new Audio(this.footstepSoundPaths[chosenIndex]);
    audio.volume = 0.3 * volumeMultiplier;
    audio.play().catch(() => {});
  }

  updateFootsteps(delta) {
    // Only check footsteps during movement animations
    if (
      !this.footstepAnimations.has(this.currentAnimation) ||
      !this.isGrounded ||
      this.jumpPhase !== "none" ||
      this.isRolling
    ) {
      return;
    }

    // Get current speed to adjust footstep rate
    const vel = this.rigidBody.linvel();
    const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    const isRunning = horizontalSpeed > this.config.WALK_SPEED * 1.5;

    // Adjust cooldown based on speed (faster = shorter cooldown)
    // For running, use a longer cooldown to prevent too many sounds
    const baseCooldown = isRunning ? 0.2 : 0.25;
    const speedFactor = Math.min(horizontalSpeed / this.config.RUN_SPEED, 1.5);
    const adjustedCooldown = baseCooldown / Math.max(speedFactor, 0.5);

    // Ensure minimum cooldown to prevent rapid fire sounds
    const minCooldown = isRunning ? 0.12 : 0.18;
    const finalCooldown = Math.max(adjustedCooldown, minCooldown);

    // Process left foot using hitToi distance detection (works for all animations including crouch)
    let leftHit = null;
    if (this.leftFootBone) {
      this.leftFootBone.getWorldPosition(this.leftFootWorldPosition);

      if (!this.leftFootInitialized) {
        this.prevLeftFootPosition.copy(this.leftFootWorldPosition);
        this.leftFootInitialized = true;
      } else {
        // Calculate vertical velocity and movement
        const verticalVelocity =
          (this.leftFootWorldPosition.y - this.prevLeftFootPosition.y) /
          Math.max(delta, 1e-4);
        const verticalDelta =
          this.prevLeftFootPosition.y - this.leftFootWorldPosition.y;
        const movementDelta = Math.sqrt(
          Math.pow(
            this.leftFootWorldPosition.x - this.prevLeftFootPosition.x,
            2
          ) +
            Math.pow(
              this.leftFootWorldPosition.z - this.prevLeftFootPosition.z,
              2
            )
        );

        const hit = this.castFootRay(this.leftFootWorldPosition);
        const hitToi = hit?.hitToi ?? null;
        const slopeFactor = hit?.slopeFactor ?? 0;

        // Foot is grounded if hitToi is small (foot close to ground)
        // Use slightly larger threshold for steep slopes
        const groundedFoot =
          typeof hitToi === "number" &&
          hitToi < (slopeFactor > 0.4 ? 0.28 : 0.23);

        // Trigger footstep ONLY on transition from not grounded to grounded
        // This prevents multiple triggers per footstep
        const triggered =
          groundedFoot &&
          !this.leftFootWasGrounded &&
          this.footstepCooldown <= 0 &&
          (verticalVelocity < -0.02 ||
            verticalDelta > 0.006 ||
            slopeFactor > 0.35 ||
            movementDelta > 0.02);

        if (triggered) {
          leftHit = hit;
          // Set cooldown immediately to prevent both feet triggering in same frame
          this.footstepCooldown = finalCooldown;
        }

        this.prevLeftFootPosition.copy(this.leftFootWorldPosition);
        this.leftFootWasGrounded = groundedFoot;
        this.leftFootPrevToi =
          groundedFoot && typeof hitToi === "number" ? hitToi : 1;
      }
    }

    // Process right foot
    let rightHit = null;
    if (this.rightFootBone) {
      this.rightFootBone.getWorldPosition(this.rightFootWorldPosition);

      if (!this.rightFootInitialized) {
        this.prevRightFootPosition.copy(this.rightFootWorldPosition);
        this.rightFootInitialized = true;
      } else {
        // Calculate vertical velocity and movement
        const verticalVelocity =
          (this.rightFootWorldPosition.y - this.prevRightFootPosition.y) /
          Math.max(delta, 1e-4);
        const verticalDelta =
          this.prevRightFootPosition.y - this.rightFootWorldPosition.y;
        const movementDelta = Math.sqrt(
          Math.pow(
            this.rightFootWorldPosition.x - this.prevRightFootPosition.x,
            2
          ) +
            Math.pow(
              this.rightFootWorldPosition.z - this.prevRightFootPosition.z,
              2
            )
        );

        const hit = this.castFootRay(this.rightFootWorldPosition);
        const hitToi = hit?.hitToi ?? null;
        const slopeFactor = hit?.slopeFactor ?? 0;

        // Foot is grounded if hitToi is small (foot close to ground)
        const groundedFoot =
          typeof hitToi === "number" &&
          hitToi < (slopeFactor > 0.4 ? 0.28 : 0.23);

        // Trigger footstep ONLY on transition from not grounded to grounded
        // This prevents multiple triggers per footstep
        const triggered =
          groundedFoot &&
          !this.rightFootWasGrounded &&
          this.footstepCooldown <= 0 &&
          (verticalVelocity < -0.02 ||
            verticalDelta > 0.006 ||
            slopeFactor > 0.35 ||
            movementDelta > 0.02);

        if (triggered) {
          rightHit = hit;
          // Set cooldown immediately to prevent both feet triggering in same frame
          this.footstepCooldown = finalCooldown;
        }

        this.prevRightFootPosition.copy(this.rightFootWorldPosition);
        this.rightFootWasGrounded = groundedFoot;
        this.rightFootPrevToi =
          groundedFoot && typeof hitToi === "number" ? hitToi : 1;
      }
    }

    // Play footstep sound and spawn particles if either foot triggered
    // Cooldown is already set when foot triggers, so we just need to play sound once
    if (leftHit || rightHit) {
      const volumeMultiplier = isRunning
        ? 1.2
        : this.currentAnimation === "crouchWalk"
        ? 0.7
        : 1.0;
      this.playFootstepSound(volumeMultiplier);

      // Spawn footstep particles
      if (this.config.enableFootstepParticles && this.footstepParticles) {
        const hitsToProcess = [];
        if (leftHit) hitsToProcess.push(leftHit);
        if (rightHit) hitsToProcess.push(rightHit);

        hitsToProcess.forEach((hit) => {
          if (hit) {
            this.footstepParticles.spawn({
              position: hit.point,
              normal: hit.normal,
              slopeFactor: hit.slopeFactor,
            });
          }
        });
      }
    }
  }

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  lerpAngle(start, end, t) {
    start = this.normalizeAngle(start);
    end = this.normalizeAngle(end);

    if (Math.abs(end - start) > Math.PI) {
      if (end > start) {
        start += 2 * Math.PI;
      } else {
        end += 2 * Math.PI;
      }
    }

    return this.normalizeAngle(start + (end - start) * t);
  }

  update(delta, interpolationAlpha = 0) {
    if (!this.rigidBody) return;

    // Force reset animationGroup position and rotation every frame to prevent jitter/sliding
    // This matches the approach in wawa-game-template for smooth animations
    // Do this BEFORE mixer update to ensure clean state
    if (this.animationGroup) {
      this.animationGroup.position.set(0, this.currentCharacterYOffset, 0);
      this.animationGroup.rotation.set(0, 0, 0);
    }

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Animation change cooldown
    this.animationChangeCooldown = Math.max(
      this.animationChangeCooldown - delta,
      0
    );

    // Footstep cooldown
    this.footstepCooldown = Math.max(this.footstepCooldown - delta, 0);

    // Update footstep particles
    if (this.footstepParticles) {
      this.footstepParticles.update(delta);
    }

    const vel = this.rigidBody.linvel();
    if (!vel) return;

    // Update foot positions and detect footsteps
    this.updateFootsteps(delta);

    // Ground detection
    let grounded = this.checkGroundedRapier();

    if (this.crouchTransitioning) {
      grounded = true;
    }

    this.isGrounded = grounded;

    // Crouch logic
    const hasCeilingClearance = this.isCrouching
      ? this.checkCeilingClearance()
      : true;

    if (this.keys.crouch) {
      this.ceilingClearanceTimer = -1;
    } else if (!hasCeilingClearance && this.isCrouching) {
      this.ceilingClearanceTimer = 0;
    } else if (
      hasCeilingClearance &&
      this.isCrouching &&
      this.ceilingClearanceTimer >= 0
    ) {
      this.ceilingClearanceTimer += delta;
    } else if (!this.isCrouching) {
      this.ceilingClearanceTimer = -1;
    }

    const standUpDelay = 0.5;
    let shouldBeCrouched;

    if (this.keys.crouch) {
      shouldBeCrouched = true;
      this.ceilingClearanceTimer = -1;
    } else if (!hasCeilingClearance) {
      shouldBeCrouched = true;
    } else if (
      this.ceilingClearanceTimer >= 0 &&
      this.ceilingClearanceTimer < standUpDelay
    ) {
      shouldBeCrouched = true;
    } else {
      shouldBeCrouched = false;
    }

    // Landing detection
    if (!this.wasGrounded && grounded) {
      this.jumpPhase = "land";
      this.setAnimation("jumpLand");

      vel.x *= 0.2;
      vel.z *= 0.2;

      if (this.footstepCooldown <= 0.05) {
        this.playFootstepSound();
        this.footstepCooldown = 0.25;
      }

      // Spawn landing particles
      if (this.config.enableFootstepParticles && this.footstepParticles) {
        const landingHits = [];

        // Try to get foot positions first
        if (this.leftFootBone) {
          this.leftFootBone.getWorldPosition(this.leftFootWorldPosition);
          const hit = this.castFootRay(this.leftFootWorldPosition);
          if (hit) landingHits.push(hit);
        }
        if (this.rightFootBone) {
          this.rightFootBone.getWorldPosition(this.rightFootWorldPosition);
          const hit = this.castFootRay(this.rightFootWorldPosition);
          if (hit) landingHits.push(hit);
        }

        // Try center position
        if (landingHits.length === 0 && this.character) {
          const centerPos = new THREE.Vector3();
          this.character.getWorldPosition(centerPos);
          const hit = this.castFootRay(centerPos);
          if (hit) landingHits.push(hit);
        }

        // Fallback: spawn at bottom of capsule even if raycast fails
        if (landingHits.length === 0 && this.rigidBody) {
          const position = this.rigidBody.translation();
          const currentHalfHeight = this.currentCapsuleHalfHeight;
          // Position at bottom of capsule (where feet touch ground)
          const bottomPos = new THREE.Vector3(
            position.x,
            position.y - currentHalfHeight - this.config.capsuleRadius,
            position.z
          );
          // Create a fallback hit even if raycast doesn't work
          landingHits.push({
            point: bottomPos,
            normal: new THREE.Vector3(0, 1, 0),
            slopeFactor: 0,
            hitToi: 0,
          });
        }

        // Spawn particles for all landing hits
        landingHits.forEach((hit) => {
          if (hit) {
            this.footstepParticles.spawn({
              position: hit.point,
              normal: hit.normal,
              slopeFactor: hit.slopeFactor,
            });
          }
        });
      }

      setTimeout(() => {
        if (this.jumpPhase === "land") {
          this.jumpPhase = "none";
        }
      }, 300);
    }

    // Roll input - check after landing but before movement animations
    if (
      this.keys.roll &&
      !this.rollPressed &&
      grounded &&
      !shouldBeCrouched &&
      !this.keys.dance &&
      !this.isAttacking &&
      !this.isRolling
    ) {
      this.rollPressed = true;
      this.isRolling = true;
      this.jumpPhase = "none";
      this.setAnimation("roll");

      // Update capsule to rolling height (lower, more like a sphere)
      const rollHalfHeight = this.config.capsuleRadius; // Same as radius for rolling
      this.updateCapsuleCollider(rollHalfHeight);

      const rollSpeed = this.config.RUN_SPEED * 1.2;
      const facingRotation = this.rotationTarget + this.characterRotationTarget;

      // Store roll direction and speed for maintaining velocity during roll
      this.rollDirection = facingRotation;
      this.rollSpeed = rollSpeed;

      vel.x = Math.sin(facingRotation) * rollSpeed;
      vel.z = Math.cos(facingRotation) * rollSpeed;

      setTimeout(() => {
        this.isRolling = false;
        this.rollDirection = undefined;
        this.rollSpeed = undefined;
        // Restore capsule to standing height when roll ends
        const standingHalfHeight = this.config.capsuleHeight / 2;
        this.updateCapsuleCollider(standingHalfHeight);
      }, 800);
    } else if (!this.keys.roll) {
      this.rollPressed = false;
    }

    // Falling detection
    if (
      !grounded &&
      this.jumpPhase === "none" &&
      !shouldBeCrouched &&
      !this.crouchTransitioning &&
      !this.isRolling
    ) {
      this.jumpPhase = "loop";
      this.setAnimation("jumpLoop");
    }

    this.wasGrounded = grounded;

    const movement = { x: 0, z: 0, walkBackwardMode: false };

    // Dance
    if (this.keys.dance) {
      this.setAnimation("dance");
      movement.x = 0;
      movement.z = 0;
    }

    // Update capsule on crouch state change
    if (shouldBeCrouched !== this.isCrouching) {
      const standingHalfHeight = this.config.capsuleHeight / 2;
      const crouchHalfHeight = (this.config.capsuleHeight * 0.5) / 2;

      this.crouchTransitioning = true;
      this.jumpPhase = "none";

      setTimeout(() => {
        this.crouchTransitioning = false;
      }, 200);

      if (shouldBeCrouched) {
        // Update capsule to crouch height
        this.updateCapsuleCollider(crouchHalfHeight);
      } else {
        // Update capsule to standing height
        this.updateCapsuleCollider(standingHalfHeight);
        this.setAnimation("idle");
      }

      this.isCrouching = shouldBeCrouched;
    }

    // Movement input
    if (this.keys.forward) movement.z = 1;
    if (this.keys.backward) movement.z = -1;
    if (this.keys.left) movement.x = 1;
    if (this.keys.right) movement.x = -1;

    if (movement.x !== 0) {
      this.rotationTarget += this.config.ROTATION_SPEED * movement.x;
    }

    // Speed
    let speed = this.keys.run ? this.config.RUN_SPEED : this.config.WALK_SPEED;
    if (shouldBeCrouched) {
      speed = this.config.WALK_SPEED * 0.5;
    }

    if (movement.x !== 0 || movement.z !== 0) {
      const baseMovementAngle = movement.walkBackwardMode
        ? Math.atan2(movement.x, 1)
        : Math.atan2(movement.x, movement.z);

      const movementRotation = this.rotationTarget + baseMovementAngle;

      let intendedVelX = Math.sin(movementRotation) * speed;
      let intendedVelZ = Math.cos(movementRotation) * speed;

      if (movement.walkBackwardMode) {
        this.characterRotationTarget = Math.atan2(movement.x, 1);
      } else {
        this.characterRotationTarget = Math.atan2(movement.x, movement.z);
      }

      if (movement.walkBackwardMode && movement.z < 0) {
        intendedVelX = -intendedVelX;
        intendedVelZ = -intendedVelZ;
      }

      if (grounded && this.jumpPhase !== "land" && !this.isRolling) {
        vel.x = intendedVelX;
        vel.z = intendedVelZ;
      }

      // Jump
      if (this.keys.jump && grounded && !this.jumpPressed) {
        this.jumpPressed = true;
        vel.y = this.config.JUMP_FORCE;
        vel.x = intendedVelX;
        vel.z = intendedVelZ;

        this.jumpPhase = "start";
        this.setAnimation("jumpStart");

        setTimeout(() => {
          if (this.jumpPhase === "start") {
            this.jumpPhase = "loop";
            this.setAnimation("jumpLoop");
          }
        }, 200);
      } else if (!this.keys.jump) {
        this.jumpPressed = false;
      }

      // Movement animations - only if not jumping and not in any jump phase and not rolling
      const isInJumpPhase = this.jumpPhase !== "none";
      if (
        grounded &&
        !isInJumpPhase &&
        !this.keys.dance &&
        !this.isAttacking &&
        !this.isRolling
      ) {
        if (shouldBeCrouched) {
          this.setAnimation("crouchWalk");
        } else if (this.combatMode) {
          this.setAnimation("swordIdle");
        } else if (speed === this.config.RUN_SPEED) {
          this.setAnimation("run");
        } else if (movement.walkBackwardMode) {
          this.setAnimation("walkBackwards");
        } else {
          this.setAnimation("walk");
        }
      }
    } else {
      // No movement
      if (grounded && !this.isRolling) {
        vel.x *= 0.85;
        vel.z *= 0.85;

        if (Math.abs(vel.x) < 0.01) vel.x = 0;
        if (Math.abs(vel.z) < 0.01) vel.z = 0;
      }

      // Jump standing still
      if (this.keys.jump && grounded && !this.jumpPressed) {
        this.jumpPressed = true;
        vel.y = this.config.JUMP_FORCE;

        this.jumpPhase = "start";
        this.setAnimation("jumpStart");

        setTimeout(() => {
          if (this.jumpPhase === "start") {
            this.jumpPhase = "loop";
            this.setAnimation("jumpLoop");
          }
        }, 200);
      } else if (!this.keys.jump) {
        this.jumpPressed = false;
      }

      // Idle animations - only if not jumping and not in any jump phase
      const isInJumpPhaseIdle = this.jumpPhase !== "none";
      if (
        grounded &&
        !isInJumpPhaseIdle &&
        !this.keys.dance &&
        !this.isAttacking &&
        !this.isRolling
      ) {
        if (shouldBeCrouched) {
          this.setAnimation("crouchIdle");
        } else if (this.combatMode) {
          this.setAnimation("swordIdle");
        } else {
          this.setAnimation("idle");
        }
      }
    }

    // Character rotation
    if (this.character) {
      let targetRotation = this.characterRotationTarget;
      if (this.cameraMode === "follow-orbit") {
        targetRotation = this.characterRotationTarget - this.mouseOrbitOffset;
      }

      this.character.rotation.y = this.lerpAngle(
        this.character.rotation.y,
        targetRotation,
        0.1
      );
    }

    // Maintain roll velocity during roll (prevent slowdown from damping)
    // This ensures roll maintains speed like jump does - constant velocity throughout
    // Do this RIGHT BEFORE setting velocity to override any damping or movement input
    if (
      this.isRolling &&
      grounded &&
      this.rollDirection !== undefined &&
      this.rollSpeed !== undefined
    ) {
      // Maintain constant roll speed throughout the roll
      // This prevents the "no movement" damping from slowing down the roll
      vel.x = Math.sin(this.rollDirection) * this.rollSpeed;
      vel.z = Math.cos(this.rollDirection) * this.rollSpeed;
    }

    // Update velocity
    this.rigidBody.setLinvel(vel, true);

    // Update position with interpolation for smooth rendering
    const position = this.rigidBody.translation();

    // Store current physics position (after physics step)
    this.currentPosition.set(position.x, position.y, position.z);

    // Interpolate between previous and current physics position
    // This smooths out the visual representation between physics steps
    // interpolationAlpha (0-1) represents how far we are between the last physics step and the next
    // Since we're called after physics step, we interpolate between prevPosition (before step) and currentPosition (after step)
    if (this.prevPosition.lengthSq() === 0) {
      // First frame: initialize previous position
      this.prevPosition.copy(this.currentPosition);
      this.container.position.copy(this.currentPosition);
    } else {
      // Interpolate: lerp from previous position (before physics step) to current position (after physics step)
      // Alpha tells us how much of the way we are between physics steps
      this.container.position.lerpVectors(
        this.prevPosition,
        this.currentPosition,
        interpolationAlpha
      );
    }

    // At the end of the frame, store current position as previous for next frame
    // This becomes the "before physics step" position for the next frame
    this.prevPosition.copy(this.currentPosition);

    // Camera update
    if (this.cameraMode === "follow" || this.cameraMode === "follow-orbit") {
      const baseRotation = this.rotationTarget;
      const finalRotation =
        this.cameraMode === "follow-orbit"
          ? baseRotation + this.mouseOrbitOffset
          : baseRotation;

      this.container.rotation.y = THREE.MathUtils.lerp(
        this.container.rotation.y,
        finalRotation,
        this.config.cameraLerpSpeed
      );

      this.cameraPosition.getWorldPosition(this.cameraWorldPosition);

      const isFirstFrame = !this.cameraInitialized;

      if (isFirstFrame) {
        this.camera.position.copy(this.cameraWorldPosition);
      } else {
        this.camera.position.lerp(
          this.cameraWorldPosition,
          this.config.cameraLerpSpeed
        );
      }

      this.cameraTarget.getWorldPosition(this.cameraLookAtWorldPosition);

      if (isFirstFrame) {
        this.cameraLookAt.copy(this.cameraLookAtWorldPosition);
      } else {
        this.cameraLookAt.lerp(
          this.cameraLookAtWorldPosition,
          this.config.cameraLerpSpeed
        );
      }

      if (this.cameraMode === "follow-orbit") {
        const verticalRotationOffset = Math.sin(this.mouseVerticalOffset) * 2;
        this.cameraLookAt.y =
          this.cameraLookAtWorldPosition.y + verticalRotationOffset;
      }

      this.camera.lookAt(this.cameraLookAt);

      if (isFirstFrame) {
        this.cameraInitialized = true;
      }
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener(
      "pointerlockchange",
      this.handlePointerLockChange
    );

    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.removeEventListener("click", this.handleClick);
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
    }

    if (this.rigidBody && this.world) {
      this.world.removeRigidBody(this.rigidBody);
    }

    // Dispose footstep particles
    if (this.footstepParticles) {
      this.footstepParticles.dispose();
      this.footstepParticles = null;
    }

    this.scene.remove(this.container);
  }
}
