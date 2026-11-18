import { formatBytes, models, type ModelEntry } from '../catalog';

export function Catalog({ selected, onSelect, compact = false, disabled = false }: {
  selected: string; onSelect: (model: ModelEntry) => void; compact?: boolean; disabled?: boolean;
}) {
  return <section className={`catalog ${compact ? 'catalog-compact' : ''}`} aria-label="Каталог моделей">
    <div className="section-heading"><h2>Каталог моделей</h2><span>{models.length} модель</span></div>
    <div className="model-grid">
      {models.map((model) => <button key={model.id} type="button" className="model-card"
        aria-pressed={selected === model.id} disabled={disabled} onClick={() => onSelect(model)}>
        <div className="model-preview"><img src={model.preview} alt={`3D-модель ${model.name}`} width="800" height="450" />
          <span className="selection-badge">{selected === model.id ? '✓ Выбрано' : 'Выбрать'}</span></div>
        <div className="model-description"><div><strong>{model.name}</strong><p>{model.description}</p></div>
          <span className="file-size">{formatBytes(model.bytes)}<small>GLB</small></span></div>
      </button>)}
    </div>
  </section>;
}
