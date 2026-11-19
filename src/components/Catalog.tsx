import { formatBytes, models, type ModelEntry } from '../catalog';

const forms: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'модель', few: 'модели', many: 'моделей' };
const countLabel = `${models.length} ${forms[new Intl.PluralRules('ru').select(models.length)] ?? 'моделей'}`;

export function Catalog({ selected, onSelect, compact = false, disabled = false }: {
  selected: string; onSelect: (model: ModelEntry) => void; compact?: boolean; disabled?: boolean;
}) {
  return <section className={`catalog ${compact ? 'catalog-compact' : ''}`} aria-label="Каталог моделей">
    <div className="section-heading"><h2>Каталог моделей</h2><span>{countLabel}</span></div>
    <div className="model-grid">
      {models.map((model) => <button key={model.id} type="button" className="model-card"
        aria-pressed={selected === model.id} disabled={disabled} onClick={() => onSelect(model)}>
        <div className="model-preview"><img src={model.preview} alt={`3D-модель ${model.name}`} width="800" height="450" />
          <span className="selection-badge">{selected === model.id ? 'Выбрано' : 'Выбрать'}</span></div>
        <div className="model-description"><div><strong>{model.name}</strong><p>{model.description}</p></div>
          <span className="file-size">{formatBytes(model.bytes)}<small>{model.animated ? 'GLB · Анимация' : 'GLB'}</small></span></div>
      </button>)}
    </div>
  </section>;
}
