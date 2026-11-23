import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProfessorState, StageConfig } from '../types/game';

export interface SceneVisualState {
  professorState: ProfessorState;
  isPhoneVisible: boolean;
  isCaught: boolean;
  suspicion: number; // 0..100
  aisleWalkProgress: number; // 0..1 (0 = podium, 1 = middle aisle)
  timeRemainingRatio: number; // 1..0
  caughtStudentIndex: number | null;
  sneakingStudentIndex: number | null;
}

const _lookTarget = new THREE.Vector3();
const _camPosTarget = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = grainHex;
  for (let i = 0; i < 65; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.12;
    ctx.lineWidth = 1 + Math.random() * 3;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createChalkboardTexture(stage: StageConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Chalkboard matte slate green
  const grad = ctx.createLinearGradient(0, 0, 1024, 512);
  grad.addColorStop(0, '#1e3c30');
  grad.addColorStop(0.5, '#244738');
  grad.addColorStop(1, '#1b352a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle chalk dust smudges
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(240, 245, 240, ${0.015 + Math.random() * 0.025})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 1024,
      Math.random() * 512,
      40 + Math.random() * 110,
      15 + Math.random() * 45,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Title
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 34px "Noto Sans KR", sans-serif';
  ctx.fillText(stage.chalkboardTitle, 48, 72);

  ctx.strokeStyle = 'rgba(254, 243, 199, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 92);
  ctx.lineTo(680, 92);
  ctx.stroke();

  // Lecture lines
  ctx.font = '500 24px "Noto Sans KR", sans-serif';
  stage.chalkboardLines.forEach((line, idx) => {
    ctx.fillStyle = idx === stage.chalkboardLines.length - 1 ? '#fda4af' : 'rgba(241, 245, 249, 0.9)';
    ctx.fillText(line, 52, 148 + idx * 54);
  });

  // Right-side chalk diagram
  ctx.strokeStyle = 'rgba(167, 243, 208, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(720, 120, 245, 190);
  ctx.beginPath();
  ctx.moveTo(745, 280);
  ctx.quadraticCurveTo(810, 150, 940, 165);
  ctx.stroke();

  ctx.fillStyle = 'rgba(167, 243, 208, 0.85)';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('P(safe | write) = 0.98', 735, 348);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTextbookTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(0, 0, 512, 320);

  // Center spine shadow
  const spine = ctx.createLinearGradient(236, 0, 276, 0);
  spine.addColorStop(0, 'rgba(0,0,0,0)');
  spine.addColorStop(0.5, 'rgba(0,0,0,0.16)');
  spine.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spine;
  ctx.fillRect(236, 0, 40, 320);

  // Simulated text lines & highlight
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 16px "Noto Sans KR", sans-serif';
  ctx.fillText('Ch.04 핵심 요약 노트', 28, 42);
  ctx.fillText('연습 문제 풀이', 280, 42);

  ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
  ctx.fillRect(26, 78, 175, 14);
  ctx.fillRect(280, 124, 185, 14);

  ctx.fillStyle = '#64748b';
  for (let row = 0; row < 10; row++) {
    ctx.fillRect(28, 62 + row * 22, 160 + (row % 3) * 18, 5);
    ctx.fillRect(280, 62 + row * 22, 150 + ((row + 1) % 3) * 20, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface ProfessorRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  gazeSpot: THREE.SpotLight;
  gazeTarget: THREE.Object3D;
}

interface StudentRig {
  root: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  phoneMesh: THREE.Mesh;
  caughtRing: THREE.Mesh;
  seatX: number;
  seatZ: number;
  phase: number;
}

export class ClassroomSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private professor!: ProfessorRig;
  private students: StudentRig[] = [];
  private chalkboardMesh!: THREE.Mesh;
  private chalkboardTex!: THREE.CanvasTexture;
  private playerPen!: THREE.Group;
  private clockMinuteHand!: THREE.Mesh;
  private clockHourHand!: THREE.Mesh;

  private visualState: SceneVisualState = {
    professorState: ProfessorState.WRITING,
    isPhoneVisible: false,
    isCaught: false,
    suspicion: 0,
    aisleWalkProgress: 0,
    timeRemainingRatio: 1,
    caughtStudentIndex: null,
    sneakingStudentIndex: null,
  };

  // Smoothly damped camera & actor vars
  private camYawOffset = 0;
  private camPitchOffset = 0;
  private targetYawOffset = 0;
  private targetPitchOffset = 0;
  private currentCamPitch = -0.02;
  private currentProfYaw = Math.PI; // Facing chalkboard (-Z is away from player, wait: chalkboard is at -Z, player looks toward -Z)
  private currentHeadYaw = 0;
  private currentProfX = -0.6;
  private currentProfZ = -3.35;
  private walkPhase = 0;

  // Cleanup tracking
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(container: HTMLElement, initialStage: StageConfig) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || 390, container.clientHeight || 844);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfd7ca);
    this.scene.fog = new THREE.FogExp2(0xdfd7ca, 0.032);

    const aspect = (container.clientWidth || 390) / (container.clientHeight || 844);
    const fov = aspect < 0.85 ? 58 : 48;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 40);
    // Seated in Row 3, right-of-aisle seat
    this.camera.position.set(0.75, 1.32, 2.85);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposables.push(envTex);
    pmrem.dispose();

    this.setupLighting();
    this.buildRoom(initialStage);
    this.buildDesksAndStudents();
    this.buildPlayerDesk();
    this.buildProfessor();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onResize);

    this.startLoop();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private setupLighting() {
    const hemi = new THREE.HemisphereLight(0xeef6ff, 0x7c6853, 0.95);
    this.scene.add(hemi);

    // Warm afternoon sun streaming through left windows
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.65);
    sun.position.set(-7, 6.5, 2.5);
    if (!this.isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 22;
      sun.shadow.camera.left = -7;
      sun.shadow.camera.right = 7;
      sun.shadow.camera.top = 6;
      sun.shadow.camera.bottom = -6;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.02;
    }
    this.scene.add(sun);

    // Overhead classroom ceiling fluorescent fill
    const ceilingFill = new THREE.DirectionalLight(0xf8fafc, 0.55);
    ceilingFill.position.set(2, 5, -2);
    this.scene.add(ceilingFill);
  }

  private buildRoom(stage: StageConfig) {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    const floorTex = this.track(createWoodTexture('#b6895b', '#7c5530'));
    floorTex.repeat.set(4, 4);
    floorTex.anisotropy = maxAniso;

    const floorGeo = this.track(new THREE.PlaneGeometry(12, 12));
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.72,
        metalness: 0.02,
      }),
    );
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Walls
    const wallMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xe7e0d3, roughness: 0.9, metalness: 0 }),
    );
    const frontWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(12, 4.6, 0.2)), wallMat);
    frontWall.position.set(0, 2.3, -4.6);
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    const rightWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.2, 4.6, 12)), wallMat);
    rightWall.position.set(4.8, 2.3, 0);
    this.scene.add(rightWall);

    // Left wall with bright window bays
    const leftWallLower = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.2, 1.35, 12)), wallMat);
    leftWallLower.position.set(-4.8, 0.675, 0);
    this.scene.add(leftWallLower);

    const leftWallUpper = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.2, 0.9, 12)), wallMat);
    leftWallUpper.position.set(-4.8, 4.15, 0);
    this.scene.add(leftWallUpper);

    const windowGlowMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0xfff8ea }),
    );
    const windowFrameMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.5 }),
    );
    for (let z = -3; z <= 3; z += 2.6) {
      const pane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.1, 2.3)), windowGlowMat);
      pane.rotation.y = Math.PI / 2;
      pane.position.set(-4.72, 2.5, z);
      this.scene.add(pane);

      const mullion = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.14, 2.4, 0.12)), windowFrameMat);
      mullion.position.set(-4.68, 2.5, z + 1.15);
      this.scene.add(mullion);
    }

    // Ceiling + Light Panels
    const ceiling = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(12, 12)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.95 })),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.5;
    this.scene.add(ceiling);

    const fixtureMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff8e7,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      }),
    );
    for (const x of [-1.8, 1.8]) {
      for (const z of [-2.2, 0.8]) {
        const panel = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.1, 0.06, 0.35)), fixtureMat);
        panel.position.set(x, 4.46, z);
        this.scene.add(panel);
      }
    }

    // Raised wooden podium platform at front
    const podiumPlatform = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(7.2, 0.18, 1.8)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.7 })),
    );
    podiumPlatform.position.set(0, 0.09, -3.65);
    podiumPlatform.receiveShadow = true;
    this.scene.add(podiumPlatform);

    // Lectern (Professor's podium desk)
    const lecternGroup = new THREE.Group();
    const lecternMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.65 }),
    );
    const lecternBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 1.05, 0.55)), lecternMat);
    lecternBase.position.y = 0.525;
    lecternBase.castShadow = true;
    lecternGroup.add(lecternBase);
    const lecternTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.02, 0.08, 0.66)), lecternMat);
    lecternTop.position.set(0, 1.07, 0.02);
    lecternTop.rotation.x = 0.14;
    lecternGroup.add(lecternTop);
    lecternGroup.position.set(-1.55, 0.18, -3.15);
    this.scene.add(lecternGroup);

    // Chalkboard Frame & Surface
    const boardFrame = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.6, 2.15, 0.1)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 })),
    );
    boardFrame.position.set(0, 2.35, -4.48);
    this.scene.add(boardFrame);

    this.chalkboardTex = this.track(createChalkboardTexture(stage));
    this.chalkboardTex.anisotropy = maxAniso;
    const boardMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.chalkboardTex,
        roughness: 0.88,
        metalness: 0.02,
      }),
    );
    this.chalkboardMesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(5.32, 1.9)), boardMat);
    this.chalkboardMesh.position.set(0, 2.35, -4.42);
    this.scene.add(this.chalkboardMesh);

    // Chalk tray
    const tray = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(5.36, 0.06, 0.16)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.6 })),
    );
    tray.position.set(0, 1.34, -4.38);
    this.scene.add(tray);

    // Wall Clock above chalkboard
    const clockGroup = new THREE.Group();
    const clockRim = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 28)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.5 })),
    );
    clockRim.rotation.x = Math.PI / 2;
    clockGroup.add(clockRim);

    const clockFace = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(0.28, 28)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.5 })),
    );
    clockFace.position.z = 0.032;
    clockGroup.add(clockFace);

    const handMat = this.track(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    this.clockHourHand = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.022, 0.14, 0.01)), handMat);
    this.clockHourHand.geometry.translate(0, 0.06, 0);
    this.clockHourHand.position.z = 0.038;
    clockGroup.add(this.clockHourHand);

    this.clockMinuteHand = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.016, 0.21, 0.01)), handMat);
    this.clockMinuteHand.geometry.translate(0, 0.09, 0);
    this.clockMinuteHand.position.z = 0.042;
    clockGroup.add(this.clockMinuteHand);

    clockGroup.position.set(0, 3.85, -4.45);
    this.scene.add(clockGroup);
  }

  private buildDesksAndStudents() {
    const deskTopMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd1a374, roughness: 0.65, metalness: 0.02 }),
    );
    const deskLegMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.65 }),
    );
    const skinMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xf1c29b, roughness: 0.72 }),
    );
    const hairMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.85 }),
    );
    const hoodieColors = [0x3b82f6, 0x64748b, 0x10b981, 0x8b5cf6, 0xf59e0b, 0xec4899, 0x334155, 0x0ea5e9];
    const laptopMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.7 }),
    );

    // 2 rows in front of player (z = -0.85 and z = 0.75), left & right columns
    const rowZs = [-0.85, 0.75];
    const colXs = [-2.2, -0.95, 0.95, 2.2];

    let idx = 0;
    for (const z of rowZs) {
      for (const x of colXs) {
        const deskGroup = new THREE.Group();
        const top = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.96, 0.05, 0.56)), deskTopMat);
        top.position.y = 0.74;
        top.castShadow = true;
        top.receiveShadow = true;
        deskGroup.add(top);

        for (const lx of [-0.42, 0.42]) {
          for (const lz of [-0.22, 0.22]) {
            const leg = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8)), deskLegMat);
            leg.position.set(lx, 0.36, lz);
            deskGroup.add(leg);
          }
        }

        // Open laptop or notebook on student desk
        const laptopBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.34, 0.018, 0.24)), laptopMat);
        laptopBase.position.set(0, 0.775, 0);
        deskGroup.add(laptopBase);
        const laptopLid = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.34, 0.22, 0.014)), laptopMat);
        laptopLid.position.set(0, 0.88, -0.11);
        laptopLid.rotation.x = -0.22;
        deskGroup.add(laptopLid);

        deskGroup.position.set(x, 0, z);
        this.scene.add(deskGroup);

        // Seated classmate behind desk (slightly offset z + 0.42)
        const studentRoot = new THREE.Group();
        const hoodieMat = this.track(
          new THREE.MeshStandardMaterial({
            color: hoodieColors[idx % hoodieColors.length],
            roughness: 0.85,
          }),
        );

        const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.42, 0.48, 0.24)), hoodieMat);
        torso.position.y = 0.74;
        torso.castShadow = true;
        studentRoot.add(torso);

        const head = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.135, 16, 14)), skinMat);
        head.position.y = 1.12;
        head.castShadow = true;
        studentRoot.add(head);

        const hair = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.144, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), hairMat);
        hair.position.set(0, 1.14, 0.01);
        hair.rotation.x = -0.18;
        studentRoot.add(hair);

        const backpack = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.3, 0.36, 0.12)),
          this.track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })),
        );
        backpack.position.set(0, 0.72, 0.17);
        studentRoot.add(backpack);

        studentRoot.position.set(x, 0, z + 0.44);
        this.scene.add(studentRoot);

        // Secret glowing phone held slightly below desk level (visible when sneaking)
        const phoneMesh = new THREE.Mesh(
          this.track(new THREE.BoxGeometry(0.11, 0.015, 0.19)),
          this.track(
            new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              emissive: 0x38bdf8,
              emissiveIntensity: 1.4,
              roughness: 0.2,
            }),
          ),
        );
        phoneMesh.position.set(0, 0.79, -0.22);
        phoneMesh.visible = false;
        studentRoot.add(phoneMesh);

        // Floor highlight ring when this student gets caught by the professor
        const caughtRing = new THREE.Mesh(
          this.track(new THREE.RingGeometry(0.36, 0.48, 24)),
          this.track(
            new THREE.MeshBasicMaterial({
              color: 0xf59e0b,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.9,
            }),
          ),
        );
        caughtRing.rotation.x = -Math.PI / 2;
        caughtRing.position.set(0, 0.03, 0);
        caughtRing.visible = false;
        studentRoot.add(caughtRing);

        this.students.push({
          root: studentRoot,
          head,
          torso,
          phoneMesh,
          caughtRing,
          seatX: x,
          seatZ: z + 0.44,
          phase: idx * 1.15,
        });
        idx++;
      }
    }
  }

  private buildPlayerDesk() {
    // Row 3 player's desk right in front of the camera (camera at x=0.75, y=1.32, z=2.85)
    const deskGroup = new THREE.Group();
    const woodMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xc99a69, roughness: 0.62, metalness: 0.03 }),
    );
    const deskTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.15, 0.05, 0.62)), woodMat);
    deskTop.position.y = 0.74;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    // Open textbook on left/center of player desk
    const bookCover = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.46, 0.022, 0.32)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 })),
    );
    bookCover.position.set(-0.14, 0.775, 0.02);
    bookCover.rotation.y = 0.06;
    deskGroup.add(bookCover);

    const bookTex = this.track(createTextbookTexture());
    bookTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const bookPages = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.43, 0.024, 0.29)),
      this.track(new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.9 })),
    );
    bookPages.position.set(-0.14, 0.788, 0.02);
    bookPages.rotation.y = 0.06;
    deskGroup.add(bookPages);

    // Ceramic coffee cup on right corner
    const cupMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        roughness: 0.22,
        clearcoat: 0.85,
      }),
    );
    const cup = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.042, 0.035, 0.1, 16)), cupMat);
    cup.position.set(0.36, 0.815, -0.14);
    deskGroup.add(cup);

    // Ballpoint pen
    this.playerPen = new THREE.Group();
    const penBody = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 10)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.3 })),
    );
    penBody.rotation.z = Math.PI / 2;
    this.playerPen.add(penBody);
    const penTip = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(0.007, 0.022, 10)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.2 })),
    );
    penTip.rotation.z = -Math.PI / 2;
    penTip.position.x = 0.09;
    this.playerPen.add(penTip);
    this.playerPen.position.set(-0.04, 0.81, 0.06);
    this.playerPen.rotation.y = 0.35;
    deskGroup.add(this.playerPen);

    deskGroup.position.set(0.75, 0, 2.38);
    this.scene.add(deskGroup);
  }

  private buildProfessor() {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const shoeMat = this.track(new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.42 }));
    const pantMat = this.track(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 }));
    const jacketMat = this.track(new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.82 }));
    const shirtMat = this.track(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }));
    const tieMat = this.track(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 }));
    const skinMat = this.track(new THREE.MeshStandardMaterial({ color: 0xeec19b, roughness: 0.72 }));
    const hairMat = this.track(new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 }));
    const metalMat = this.track(new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9 }));
    const lensMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.25 }),
    );

    const makeLeg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0.76, 0);
      const legMesh = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.082, 0.068, 0.72, 12)), pantMat);
      legMesh.position.y = -0.36;
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      const shoe = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.13, 0.08, 0.24)), shoeMat);
      shoe.position.set(0, -0.72, 0.04);
      shoe.castShadow = true;
      legGroup.add(shoe);
      return legGroup;
    };

    const leftLeg = makeLeg(-0.11);
    const rightLeg = makeLeg(0.11);
    bodyGroup.add(leftLeg, rightLeg);

    // Torso (Tweed Jacket + Shirt + Tie)
    const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.46, 0.62, 0.26)), jacketMat);
    torso.position.y = 1.09;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const shirt = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.16, 0.45, 0.27)), shirtMat);
    shirt.position.set(0, 1.15, 0.01);
    bodyGroup.add(shirt);

    const tie = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.055, 0.34, 0.28)), tieMat);
    tie.position.set(0, 1.11, 0.015);
    bodyGroup.add(tie);

    // Arms
    const makeArm = (xOffset: number, withChalk: boolean) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(xOffset, 1.34, 0);
      const sleeve = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.064, 0.054, 0.54, 10)), jacketMat);
      sleeve.position.y = -0.25;
      sleeve.castShadow = true;
      armGroup.add(sleeve);

      const hand = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.055, 10, 10)), skinMat);
      hand.position.y = -0.54;
      armGroup.add(hand);

      if (withChalk) {
        const chalk = new THREE.Mesh(
          this.track(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8)),
          this.track(new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.9 })),
        );
        chalk.rotation.x = Math.PI / 2;
        chalk.position.set(0, -0.56, 0.06);
        armGroup.add(chalk);
      }
      return armGroup;
    };

    const leftArm = makeArm(-0.29, false);
    const rightArm = makeArm(0.29, true);
    bodyGroup.add(leftArm, rightArm);

    // Head Group (articulated for warning head-turn before full body turn!)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.44, 0);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.155, 18, 16)), skinMat);
    head.position.y = 0.14;
    head.castShadow = true;
    headGroup.add(head);

    const hair = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.163, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      hairMat,
    );
    hair.position.set(0, 0.16, -0.02);
    hair.rotation.x = -0.25;
    headGroup.add(hair);

    // Glasses (facing +Z in local professor space)
    for (const gx of [-0.055, 0.055]) {
      const rim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.036, 0.006, 8, 18)), metalMat);
      rim.position.set(gx, 0.15, 0.145);
      headGroup.add(rim);

      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.018, 8, 8)), lensMat);
      eye.position.set(gx, 0.15, 0.135);
      headGroup.add(eye);
    }
    const bridge = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.04, 0.008, 0.008)), metalMat);
    bridge.position.set(0, 0.155, 0.146);
    headGroup.add(bridge);

    // Expressive eyebrows
    const browMat = this.track(new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 }));
    const leftBrow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.055, 0.014, 0.016)), browMat);
    leftBrow.position.set(-0.055, 0.2, 0.145);
    const rightBrow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.055, 0.014, 0.016)), browMat);
    rightBrow.position.set(0.055, 0.2, 0.145);
    headGroup.add(leftBrow, rightBrow);

    // Mustache
    const mustache = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.09, 0.022, 0.02)), browMat);
    mustache.position.set(0, 0.09, 0.148);
    headGroup.add(mustache);

    // Subtle Professor Gaze SpotLight (highlights danger when turning toward class)
    const gazeTarget = new THREE.Object3D();
    gazeTarget.position.set(0, 0.8, 3.2);
    headGroup.add(gazeTarget);

    const gazeSpot = new THREE.SpotLight(0xef4444, 0, 11, Math.PI / 5, 0.65, 1.5);
    gazeSpot.position.set(0, 0.16, 0.16);
    gazeSpot.target = gazeTarget;
    headGroup.add(gazeSpot);

    root.position.set(this.currentProfX, 0.18, this.currentProfZ);
    root.rotation.y = Math.PI; // Facing -Z (chalkboard) initially
    this.scene.add(root);

    this.professor = {
      root,
      bodyGroup,
      headGroup,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      leftBrow,
      rightBrow,
      gazeSpot,
      gazeTarget,
    };
  }

  public updateStageChalkboard(stage: StageConfig) {
    if (this.chalkboardTex) {
      this.chalkboardTex.dispose();
    }
    this.chalkboardTex = this.track(createChalkboardTexture(stage));
    this.chalkboardTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mat = this.chalkboardMesh.material as THREE.MeshStandardMaterial;
    mat.map = this.chalkboardTex;
    mat.needsUpdate = true;
  }

  public setVisualState(next: SceneVisualState) {
    this.visualState = next;
  }

  public nudgeCameraLook(deltaYaw: number, deltaPitch: number) {
    this.targetYawOffset = THREE.MathUtils.clamp(this.targetYawOffset + deltaYaw, -0.32, 0.32);
    this.targetPitchOffset = THREE.MathUtils.clamp(this.targetPitchOffset + deltaPitch, -0.14, 0.18);
  }

  public resetCameraLook() {
    this.targetYawOffset = 0;
    this.targetPitchOffset = 0;
  }

  private updateScene(dt: number, elapsed: number) {
    const {
      professorState,
      isPhoneVisible,
      isCaught,
      suspicion,
      aisleWalkProgress,
      timeRemainingRatio,
      caughtStudentIndex,
      sneakingStudentIndex,
    } = this.visualState;

    // 1. Update Wall Clock hands
    const progress = 1 - timeRemainingRatio;
    this.clockMinuteHand.rotation.z = -progress * Math.PI * 2;
    this.clockHourHand.rotation.z = -progress * Math.PI * 0.4;

    // 2. Classmates idle, sneaking, and caught animations
    this.students.forEach((s, idx) => {
      const isStudentCaught = caughtStudentIndex === idx;
      const isStudentSneaking = sneakingStudentIndex === idx && !isStudentCaught;

      s.phoneMesh.visible = isStudentSneaking;
      s.caughtRing.visible = isStudentCaught;

      if (isStudentCaught) {
        // Caught student jolts upright and trembles slightly
        s.head.rotation.x = 0.08 + Math.sin(elapsed * 22) * 0.04;
        s.head.rotation.y = Math.sin(elapsed * 16) * 0.1;
        s.root.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.04;
      } else if (isStudentSneaking) {
        // Looking down secretly at phone
        s.head.rotation.x = -0.34 + Math.sin(elapsed * 2.5) * 0.03;
        s.head.rotation.y = 0;
        s.root.position.y = 0;
      } else {
        s.head.rotation.x = Math.sin(elapsed * 1.4 + s.phase) * 0.05 - 0.08;
        s.head.rotation.y = Math.sin(elapsed * 0.55 + s.phase) * 0.06;
        s.root.position.y = 0;
      }
    });

    // 3. Player pen subtle study animation when hiding phone
    if (!isPhoneVisible && !isCaught) {
      this.playerPen.position.y = 0.825 + Math.sin(elapsed * 7) * 0.006;
      this.playerPen.position.x = -0.05 + Math.sin(elapsed * 3.5) * 0.035;
      this.playerPen.rotation.z = -0.35;
    } else {
      this.playerPen.position.y = THREE.MathUtils.damp(this.playerPen.position.y, 0.805, 10, dt);
      this.playerPen.rotation.z = THREE.MathUtils.damp(this.playerPen.rotation.z, 0, 10, dt);
    }

    // 4. Professor AI Kinematics
    let targetBodyYaw = Math.PI; // PI = facing chalkboard (-Z), 0 = facing students (+Z)
    let targetHeadYaw = 0;
    let targetX = this.currentProfX;
    let targetZ = -3.35;
    let targetProfY = 0.18;
    let targetSpotIntensity = 0;

    if (isCaught) {
      // Walk right down the center aisle toward player's desk!
      targetX = 0.35;
      targetZ = 1.05;
      targetProfY = 0.0;
      targetBodyYaw = 0.22;
      targetHeadYaw = 0;
      targetSpotIntensity = 4.5;
      this.professor.leftBrow.rotation.z = -0.3;
      this.professor.rightBrow.rotation.z = 0.3;
    } else if (professorState === ProfessorState.SCOLDING_OTHER && caughtStudentIndex !== null) {
      const targetStudent = this.students[caughtStudentIndex];
      if (targetStudent) {
        // Walk partway toward the caught student's row along the aisle and turn to scold them
        targetX = THREE.MathUtils.clamp(targetStudent.seatX * 0.35, -0.55, 0.55);
        targetZ = Math.min(-0.6, targetStudent.seatZ - 1.35);
        targetProfY = targetZ > -2.6 ? 0.0 : 0.18;
        const dx = targetStudent.seatX - targetX;
        const dz = targetStudent.seatZ - targetZ;
        targetBodyYaw = Math.atan2(dx, dz);
        targetHeadYaw = 0;
        targetSpotIntensity = 3.4;
        this.professor.gazeSpot.color.setHex(0xf59e0b);
        this.professor.leftBrow.rotation.z = -0.25;
        this.professor.rightBrow.rotation.z = 0.25;
      }
    } else if (professorState === ProfessorState.WRITING) {
      targetX = Math.sin(elapsed * 0.42) * 1.35;
      targetZ = -3.55;
      targetProfY = 0.18;
      targetBodyYaw = Math.PI;
      targetHeadYaw = 0;
      this.professor.leftBrow.rotation.z = 0;
      this.professor.rightBrow.rotation.z = 0;
    } else if (professorState === ProfessorState.WARNING) {
      // Stops writing, turns head over shoulder to glance!
      targetBodyYaw = Math.PI * 0.68;
      targetHeadYaw = -0.58;
      targetSpotIntensity = 0.8;
      this.professor.gazeSpot.color.setHex(0xf59e0b);
      this.professor.leftBrow.rotation.z = -0.14;
      this.professor.rightBrow.rotation.z = 0.14;
    } else if (professorState === ProfessorState.FAKEOUT) {
      // Turns halfway, hesitates, brows furrowed
      targetBodyYaw = Math.PI * 0.42;
      targetHeadYaw = -0.35;
      targetSpotIntensity = 1.4;
      this.professor.gazeSpot.color.setHex(0xf59e0b);
    } else if (professorState === ProfessorState.SCANNING) {
      // Facing class directly + optionally walking down center aisle!
      targetBodyYaw = Math.sin(elapsed * 1.6) * 0.28;
      targetHeadYaw = Math.sin(elapsed * 2.4) * 0.22;
      if (aisleWalkProgress > 0.05) {
        targetX = THREE.MathUtils.lerp(0, 0.18, aisleWalkProgress);
        targetZ = THREE.MathUtils.lerp(-3.1, 0.25, aisleWalkProgress);
        targetProfY = targetZ > -2.6 ? 0.0 : 0.18;
      } else {
        targetX = 0;
        targetZ = -3.15;
        targetProfY = 0.18;
      }
      targetSpotIntensity = 2.6 + (suspicion / 100) * 3.0;
      this.professor.gazeSpot.color.setHex(0xef4444);
      this.professor.leftBrow.rotation.z = -0.24;
      this.professor.rightBrow.rotation.z = 0.24;
    }

    const prevX = this.currentProfX;
    const prevZ = this.currentProfZ;
    this.currentProfX = THREE.MathUtils.damp(this.currentProfX, targetX, isCaught ? 5 : 3.2, dt);
    this.currentProfZ = THREE.MathUtils.damp(this.currentProfZ, targetZ, isCaught ? 4.5 : 3.5, dt);
    this.professor.root.position.x = this.currentProfX;
    this.professor.root.position.z = this.currentProfZ;
    this.professor.root.position.y = THREE.MathUtils.damp(this.professor.root.position.y, targetProfY, 8, dt);

    const turnSpeed = professorState === ProfessorState.WARNING ? 7 : professorState === ProfessorState.SCANNING ? 11 : 6;
    this.currentProfYaw = THREE.MathUtils.damp(this.currentProfYaw, targetBodyYaw, turnSpeed, dt);
    this.currentHeadYaw = THREE.MathUtils.damp(this.currentHeadYaw, targetHeadYaw, 10, dt);
    this.professor.root.rotation.y = this.currentProfYaw;
    this.professor.headGroup.rotation.y = this.currentHeadYaw;
    this.professor.gazeSpot.intensity = THREE.MathUtils.damp(this.professor.gazeSpot.intensity, targetSpotIntensity, 10, dt);

    // Walking leg stride vs Chalk writing arm / Scolding pointing arm motion
    const moveDist = Math.hypot(this.currentProfX - prevX, this.currentProfZ - prevZ);
    const speed = dt > 0 ? moveDist / dt : 0;
    if (speed > 0.12) {
      this.walkPhase += dt * speed * 4.5;
      const swing = Math.sin(this.walkPhase) * 0.42;
      this.professor.leftLeg.rotation.x = swing;
      this.professor.rightLeg.rotation.x = -swing;
      this.professor.leftArm.rotation.x = -swing * 0.7;
    } else {
      this.professor.leftLeg.rotation.x = THREE.MathUtils.damp(this.professor.leftLeg.rotation.x, 0, 10, dt);
      this.professor.rightLeg.rotation.x = THREE.MathUtils.damp(this.professor.rightLeg.rotation.x, 0, 10, dt);
      this.professor.leftArm.rotation.x = THREE.MathUtils.damp(this.professor.leftArm.rotation.x, 0, 10, dt);
    }

    if (professorState === ProfessorState.WRITING && !isCaught) {
      this.professor.rightArm.rotation.x = -1.75 + Math.sin(elapsed * 9.5) * 0.16;
      this.professor.rightArm.rotation.z = 0.22 + Math.cos(elapsed * 6.5) * 0.14;
    } else if (professorState === ProfessorState.SCOLDING_OTHER && !isCaught) {
      // Pointing & lecturing gesture toward the caught classmate
      this.professor.rightArm.rotation.x = -1.15 + Math.sin(elapsed * 8) * 0.18;
      this.professor.rightArm.rotation.z = 0;
    } else {
      this.professor.rightArm.rotation.x = THREE.MathUtils.damp(
        this.professor.rightArm.rotation.x,
        isCaught ? -0.9 : 0,
        9,
        dt,
      );
      this.professor.rightArm.rotation.z = THREE.MathUtils.damp(this.professor.rightArm.rotation.z, 0, 9, dt);
    }

    // 5. 1st-Person Camera Framing (Always keeps professor visible while giving posture feedback)
    this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, this.targetYawOffset, 10, dt);
    this.camPitchOffset = THREE.MathUtils.damp(this.camPitchOffset, this.targetPitchOffset, 10, dt);

    // Gently decay user look offset back toward center
    this.targetYawOffset = THREE.MathUtils.damp(this.targetYawOffset, 0, 1.4, dt);
    this.targetPitchOffset = THREE.MathUtils.damp(this.targetPitchOffset, 0, 1.4, dt);

    if (isCaught) {
      _camPosTarget.set(0.75, 1.38, 2.85);
      this.camera.position.lerp(_camPosTarget, Math.min(1, dt * 8));
      _lookTarget.set(this.currentProfX, 1.58, this.currentProfZ);
      this.camera.lookAt(_lookTarget);
    } else {
      const targetCamPitch = isPhoneVisible ? -0.1 : 0.03;
      const targetCamY = isPhoneVisible ? 1.24 : 1.34;
      const targetCamZ = isPhoneVisible ? 2.76 : 2.86;
      this.currentCamPitch = THREE.MathUtils.damp(this.currentCamPitch, targetCamPitch, 11, dt);

      this.camera.position.x = 0.75 + Math.sin(elapsed * 1.1) * 0.008;
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 10, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 10, dt);

      const lookDist = 6.0;
      const yaw = -0.09 + this.camYawOffset;
      const pitch = this.currentCamPitch + this.camPitchOffset;
      _lookTarget.set(
        this.camera.position.x + Math.sin(yaw) * lookDist,
        this.camera.position.y + Math.sin(pitch) * lookDist,
        this.camera.position.z - Math.cos(yaw) * lookDist,
      );
      this.camera.lookAt(_lookTarget);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.08);
      const elapsed = this.clock.getElapsedTime();

      this.updateScene(dt, elapsed);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  private onResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    this.camera.fov = aspect < 0.85 ? 58 : 48;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private onContextRestored = () => {
    if (!this.disposed) {
      this.startLoop();
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
