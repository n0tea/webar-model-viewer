import { useRef, useState } from 'react';
import { models, type ModelEntry } from './catalog';
import { marker } from './ar/marker';
import { Catalog } from './components/Catalog';
import { LoadProgress } from './components/LoadProgress';
import type { ARRuntime } from './ar/runtime';
import type { LoadState } from './ar/model-loader';

export default function App() {
  const [selected, setSelected] = useState(models[0]);
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [introStatus, setIntroStatus] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Разрешите доступ к камере.');
  const [load, setLoad] = useState<LoadState>({ phase: 'idle' });
  const runtime = useRef<ARRuntime | null>(null);
  const exit = useRef<HTMLButtonElement>(null);
  function select(model: ModelEntry) {
    setSelected(model);
    setCatalogOpen(false);
    if (active && (model.id !== selected.id || load.phase === 'error')) void runtime.current?.select(model);
  }
  async function start() {
    if (starting) return;
    setStarting(true);
    setIntroStatus('');
    try {
      const { prepareAR, ARRuntime } = await import('./ar/runtime');
      await prepareAR();
      if (runtime.current) {
        setCameraStatus('Включаем камеру…');
        setActive(true);
        if (!await runtime.current.resume()) return;
        setCameraStatus('Поместите метку в кадр.');
      } else {
        runtime.current = new ARRuntime(setLoad, setCameraStatus);
        setActive(true);
      }
      setIntroStatus('');
      void runtime.current.select(selected);
      requestAnimationFrame(() => exit.current?.focus());
    } catch (error) {
      runtime.current?.pause();
      setActive(false);
      setIntroStatus(error instanceof Error ? error.message : 'Не удалось запустить AR. Попробуйте снова.');
    } finally { setStarting(false); }
  }
  function close() {
    runtime.current?.pause();
    setActive(false);
    setCatalogOpen(false);
    setStarting(false);
    setIntroStatus('');
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#start')?.focus());
  }
  return <>
    {!active && <main id="intro">
      <header><span className="label">ДОПОЛНЕННАЯ РЕАЛЬНОСТЬ</span><h1>Модели в AR</h1>
        <p>Откройте сайт по QR-коду, выберите модель и наведите камеру на эту же карточку.</p></header>
      <Catalog selected={selected.id} onSelect={select} disabled={starting} />
      <section className="marker-card" aria-labelledby="marker-title">
        <img width="175" height="175" src={marker.imageUrl} alt="QR-код и надпись ТМХ внутри чёрной рамки" />
        <div><h2 id="marker-title">{marker.name}</h2><p>Одна карточка открывает сайт и размещает модель. Сохраните всю рамку и белое поле при печати.</p>
          <a href={marker.imageUrl} target="_blank" rel="noopener">Открыть метку для печати ↗</a></div>
      </section>
      <button id="start" className="primary" disabled={starting} onClick={start}>{starting ? 'Запускаем AR…' : `Открыть камеру · ${selected.name}`}</button>
      <p className="hint">{load.phase === 'ready' ? 'Загруженная модель сохранена до смены модели или перезагрузки страницы.' : 'Модель загрузится после запуска камеры.'}</p>
      <p id="intro-status" role="status">{introStatus}</p>
    </main>}
    {active && <aside id="camera-controls" aria-label="Управление камерой">
      <div className="camera-top">
        <div className="camera-header"><div><strong>{selected.name}</strong><span id="model-caption">{load.phase === 'ready' ? 'Модель загружена' : load.phase === 'error' ? 'Ошибка загрузки' : 'Загружаем модель…'}</span></div>
          <button id="exit" className="primary" ref={exit} onClick={close}>Закрыть камеру</button></div>
        <button className="catalog-toggle" aria-expanded={catalogOpen} aria-controls="camera-catalog" onClick={() => setCatalogOpen(!catalogOpen)}>{catalogOpen ? 'Скрыть каталог' : 'Выбрать модель'}</button>
        {catalogOpen && <div id="camera-catalog"><Catalog selected={selected.id} onSelect={select} compact /></div>}
        <LoadProgress state={load} onRetry={() => void runtime.current?.select(selected)} />
      </div>
      <p id="camera-status" role="status">{cameraStatus}</p>
    </aside>}
  </>;
}
