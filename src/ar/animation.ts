import type { AnimationAction, AnimationClip, AnimationMixer, Object3D } from 'three';

export interface AnimationState {
  clips: { name: string; duration: number }[];
  selected: number;
  time: number;
  playing: boolean;
  speed: number;
}
export const emptyAnimation: AnimationState = { clips: [], selected: 0, time: 0, playing: false, speed: 1 };

export class ModelAnimation {
  private mixer?: AnimationMixer;
  private root?: Object3D;
  private clips: AnimationClip[] = [];
  private action?: AnimationAction;
  private state: AnimationState = { ...emptyAnimation };
  private elapsed = 0;
  private notify: (state: AnimationState) => void;

  constructor(notify: (state: AnimationState) => void) { this.notify = notify; }

  private emit() {
    this.notify({ ...this.state });
    this.elapsed = 0;
  }

  attach(root: Object3D, clips: AnimationClip[]) {
    this.clear();
    this.clips = clips.filter((clip) => clip.duration > 0 && clip.tracks.length > 0);
    if (!this.clips.length) return;
    this.root = root;
    this.mixer = new window.AFRAME.THREE.AnimationMixer(root);
    this.mixer.addEventListener('finished', () => {
      this.state.playing = false;
      this.state.time = this.duration;
      this.emit();
    });
    this.state.clips = this.clips.map((clip, index) => ({ name: clip.name || `Анимация ${index + 1}`, duration: clip.duration }));
    this.select(0);
  }

  private get duration() { return this.clips[this.state.selected]?.duration ?? 0; }

  select(index: number) {
    if (!this.mixer || !this.clips[index]) return;
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(this.clips[index]);
    this.action.setLoop(window.AFRAME.THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
    this.action.paused = true;
    this.state.selected = index;
    this.state.playing = false;
    this.state.time = 0;
    this.mixer.update(0);
    this.emit();
  }

  toggle() {
    if (!this.action) return;
    if (!this.state.playing && this.state.time >= this.duration) this.seek(0);
    this.state.playing = !this.state.playing;
    this.action.paused = !this.state.playing;
    this.emit();
  }

  seek(time: number) {
    if (!this.action || !this.mixer) return;
    this.state.time = Math.max(0, Math.min(this.duration, time));
    // setTime() would also scale the seek position by timeScale. Set the action directly.
    this.action.enabled = true;
    this.action.time = this.state.time;
    this.action.paused = !this.state.playing;
    this.mixer.update(0);
    if (this.state.time >= this.duration) {
      this.state.playing = false;
      this.action.paused = true;
    }
    this.emit();
  }

  reset() {
    this.state.playing = false;
    this.seek(0);
  }

  speed(value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > 4) return;
    this.state.speed = value;
    this.emit();
  }

  update(delta: number) {
    if (!this.mixer || !this.action || !this.state.playing) return;
    this.mixer.update(Math.min(delta, 100) / 1000 * this.state.speed);
    this.state.time = Math.min(this.duration, this.action.time);
    this.elapsed += delta;
    if (this.elapsed >= 100) this.emit();
  }

  clear() {
    this.mixer?.stopAllAction();
    if (this.root) this.mixer?.uncacheRoot(this.root);
    this.action = undefined;
    this.mixer = undefined;
    this.root = undefined;
    this.clips = [];
    this.state = { ...emptyAnimation };
    this.emit();
  }
}
