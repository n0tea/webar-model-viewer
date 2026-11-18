import { formatBytes } from '../catalog';
import type { LoadState } from '../ar/model-loader';

export function LoadProgress({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  if (state.phase === 'idle' || state.phase === 'ready') return null;
  const percent = state.phase === 'downloading' && state.total
    ? Math.min(100, Math.floor(state.loaded / state.total * 100)) : undefined;
  return <div className="load-panel" aria-busy={state.phase !== 'error'}>
    {state.phase === 'error' ? <><p role="alert">{state.message}</p><button onClick={onRetry}>Повторить загрузку</button></> : <>
      <div className="progress-label" role="status"><strong>{state.phase === 'decoding' ? 'Подготавливаем модель…' : 'Загружаем модель…'}</strong>
        {state.phase === 'downloading' && <span>{percent !== undefined ? `${percent}% · ` : ''}{formatBytes(state.loaded)}{state.total ? ` / ${formatBytes(state.total)}` : ''}</span>}</div>
      <progress aria-label={state.phase === 'decoding' ? 'Подготовка модели' : 'Загрузка модели'} max="100" value={percent} />
      <p>{state.phase === 'decoding' ? 'Распаковываем геометрию и текстуры.' : 'После загрузки наведите камеру на QR-метку ТМХ.'}</p>
    </>}
  </div>;
}
