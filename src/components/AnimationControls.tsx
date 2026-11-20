import type { AnimationState } from '../ar/animation';

const timeLabel = (time: number) => `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

export function AnimationControls({ state, onToggle, onReset, onSeek, onSpeed, onSelect }: {
  state: AnimationState;
  onToggle: () => void;
  onReset: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onSelect: (index: number) => void;
}) {
  const clip = state.clips[state.selected];
  if (!clip) return null;
  return <section className="animation-panel" aria-label="Управление анимацией">
    <div className="animation-heading"><strong>{clip.name}</strong><span>{timeLabel(state.time)} / {timeLabel(clip.duration)}</span></div>
    {state.clips.length > 1 && <label>Анимация <select value={state.selected} onChange={(event) => onSelect(Number(event.target.value))}>
      {state.clips.map((item, index) => <option key={index} value={index}>{item.name}</option>)}
    </select></label>}
    <input className="animation-timeline" aria-label="Положение анимации" aria-valuetext={`${state.time.toFixed(1)} из ${clip.duration.toFixed(1)} секунд`}
      type="range" min="0" max={clip.duration} step="0.01" value={state.time} onChange={(event) => onSeek(Number(event.target.value))} />
    <div className="animation-buttons"><button className="primary playback-toggle" onClick={onToggle}
      aria-label={state.playing ? 'Пауза' : 'Воспроизвести'} title={state.playing ? 'Пауза' : 'Воспроизвести'}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        {state.playing ? <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></> : <path d="M7 4v16l13-8z" />}
      </svg>
    </button>
      <button onClick={onReset}>С начала</button>
      <label>Скорость <select aria-label="Скорость анимации" value={state.speed} onChange={(event) => onSpeed(Number(event.target.value))}>
        {[0.25, 0.5, 1, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
      </select></label></div>
    <p>Анимация воспроизводится, пока метка в кадре.</p>
  </section>;
}
