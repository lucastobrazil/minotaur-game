import type * as THREE from 'three';

/** A grid direction or offset, in maze tiles (y grows "down" the map, i.e. +z in 3D). */
export interface Vec2 { x: number; y: number }

export type GameMode = 'title' | 'play' | 'pause' | 'win' | 'assign';
export type CamMode = 'near' | 'map' | 'fp';
export type Difficulty = 'sleepy' | 'speedy';
export type Grip = 'sideways' | 'upright';
export type Axis = 'x' | 'z';
export type ItemId = 'fireball';

export interface Player {
  /** current tile */
  x: number; y: number;
  /** smoothed render position */
  px: number; py: number;
  /** spawn tile */
  sx: number; sy: number;
  /** time (ms) when the next step is allowed */
  next: number;
  /** invulnerable until (ms) */
  inv: number;
  /** last direction moved / facing */
  last: Vec2;
  face: number;
  stamina: number;
  tired: boolean;
  sprinting: boolean;
  item?: ItemId | null;
  throwPrev?: boolean;
  foot?: boolean;
  camAng?: number;
  camDt?: number;
  mesh?: THREE.Group;
  trail?: THREE.Group;
  segGeo?: THREE.BufferGeometry;
  segMat?: THREE.Material;
  orb?: THREE.Group;
}

export type MinoMode = 'wander' | 'chase' | 'stunned';

export interface MinoParts {
  legs: THREE.Group[];
  arms: THREE.Group[];
  head: THREE.Group;
  eyeMat: THREE.MeshBasicMaterial;
  mats: THREE.MeshStandardMaterial[];
}

export interface Minotaur {
  x: number; y: number;
  px: number; py: number;
  next: number;
  dir: Vec2;
  face: number;
  mode: MinoMode;
  say: string;
  sayUntil: number;
  lastSpot: number;
  hugT: number;
  puffT: number;
  enraged: boolean;
  stunUntil?: number;
  lastSeen?: number;
  mesh?: THREE.Group & { userData: MinoParts };
  bubble?: HTMLDivElement;
}

export interface Gate {
  x: number; y: number; axis: Axis;
  /** lever tile */
  lx: number; ly: number;
  /** tile on the closed-off side that opens the gate from inside */
  ix: number; iy: number;
  open: boolean;
  until: number;
  pressed: boolean;
  tick: number;
  col: string;
  bars?: THREE.Group;
  arm?: THREE.Group;
  ring?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  gl?: THREE.Sprite;
  inner?: THREE.Mesh;
}

export interface Thread {
  x: number; y: number;
  taken: boolean;
  popT?: number;
  mesh?: THREE.Group;
  pool?: THREE.Mesh;
}

export interface Room { rx: number; ry: number; px: number; py: number }

export interface Exit { x: number; y: number; axis: Axis }

export interface FireParts {
  outer: THREE.Mesh;
  inner: THREE.Mesh;
  glow: THREE.Sprite;
  seed: number;
  base: number;
}

export interface Torch {
  x: number; y: number;
  fire: THREE.Group & { userData: FireParts };
  pool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  wg?: THREE.Sprite;
}

export interface ChestParts {
  lid: THREE.Group;
  ring: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  sparks: THREE.Sprite[];
  halo: THREE.Sprite;
}

export interface Chest {
  x: number; y: number;
  g: THREE.Group & { userData: ChestParts };
  born: number;
  /** 0 = closed, >0 = opened at time, <0 = vanishing since -time */
  opened: number;
  item: ItemId;
  nag?: number;
}

export interface Fireball {
  g: THREE.Group;
  fx: number; fz: number;
  dx: number; dz: number;
  dist: number;
  trailT: number;
  dead: boolean;
}

export interface Effect {
  s: THREE.Sprite;
  t: number;
  life: number;
  v: THREE.Vector3;
  grow: number;
}

export interface FogParts {
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  S: number;
}

export interface DoorParts {
  door: THREE.Group;
  gate: THREE.Group;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  sprite: THREE.Sprite;
  exitLight: THREE.PointLight;
}

export interface GameState {
  // maze
  W: number; H: number;
  grid: number[][];
  rooms: Room[];
  exit: Exit;
  gates: Gate[];
  gateMap: Int16Array;
  threads: Thread[];
  torches: Torch[];
  explored: Uint8Array;
  sight: Uint8Array;
  // flow
  state: GameMode;
  numPlayers: number;
  modeTouched: boolean;
  difficulty: Difficulty;
  camMode: CamMode;
  level: number;
  gameActive: boolean;
  needed: number;
  got: number;
  doorOpen: boolean;
  hugs: number;
  hugsLevel: number;
  elapsed: number;
  lastT: number;
  // actors & items
  players: Player[];
  minos: Minotaur[];
  chests: Chest[];
  fireballs: Fireball[];
  fx: Effect[];
  nextChestT: number;
  carry: (ItemId | null)[];
  // rendering
  levelGroup: THREE.Group;
  fogDirty: boolean;
  fogParts: FogParts | null;
  doorParts: DoorParts | null;
  lastMini: number;
  camInit: boolean;
  camDist: number;
  lastRenderT: number;
  lastStageW: number;
  lastStageH: number;
  toastTimer: ReturnType<typeof setTimeout> | undefined;
  // audio
  muted: boolean;
  ac: AudioContext | null;
  master: GainNode | null;
  reverb: ConvolverNode | null;
  noiseB: AudioBuffer | null;
  torchNear: number;
  nextBeat: number;
  // controllers & menus
  pads: Gamepad[];
  prevBtn: Record<number, boolean[]>;
  everPad: boolean;
  lastPadCount: number;
  navFocus: HTMLElement | null;
  navT: number;
  navPrev: string;
  grip: Grip;
  assign: Set<number>[];
  splitIdx: number | null;
  assignStep: number;
  claimT: number;
  assignAfter: (() => void) | null;
  assignBack: (() => void) | null;
  assignDoneT: number;
  livePads: boolean;
  lastList: number;
}
