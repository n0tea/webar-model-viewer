export interface ModelEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  preview: string;
  bytes: number;
  markerSpan: number;
  animated?: boolean;
}

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const models: readonly ModelEntry[] = [{
  id: 'ep20',
  name: 'ЭП-20',
  description: 'Пассажирский электровоз',
  url: assetUrl('models/ep20-mobile.glb'),
  preview: assetUrl('previews/ep20.webp'),
  bytes: 9_125_116,
  markerSpan: 2.2,
}, {
  id: 'worm-gearbox-c100',
  name: 'Редуктор Ч-100',
  description: 'Червячный редуктор · анимация сборки',
  url: assetUrl('models/worm-gearbox-c100.glb'),
  preview: assetUrl('previews/worm-gearbox-c100.webp'),
  bytes: 1_409_940,
  markerSpan: 2.2,
  animated: true,
}];

export const formatBytes = (bytes: number) => `${(bytes / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
