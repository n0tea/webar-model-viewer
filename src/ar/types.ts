import type * as Three from 'three';
import type { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type { GLTF };
export type ModelObject = Three.Object3D;
export type ThreeAPI = typeof Three & { GLTFLoader: typeof GLTFLoader };

// AR.js 3.4.7 has no TypeScript definitions for its internal session.
// Keep this compatibility boundary inside the AR module.
export interface Entity extends HTMLElement {
  object3D: Three.Group;
  components: Record<string, any>;
  setObject3D(name: string, object: Three.Object3D): void;
  getObject3D(name: string): Three.Object3D | undefined;
  removeObject3D(name: string): void;
}
export interface Scene extends Entity {
  canvas: HTMLCanvasElement;
  hasLoaded: boolean;
  renderer: Three.WebGLRenderer;
  camera: Three.PerspectiveCamera;
  systems: {
    arjs: any;
    'gltf-model': { getDRACOLoader(): DRACOLoader };
  };
}
declare global {
  interface Window {
    AFRAME: {
      THREE: ThreeAPI;
      components: Record<string, unknown>;
      systems: Record<string, unknown>;
      registerComponent(name: string, definition: any): void;
    };
  }
}
