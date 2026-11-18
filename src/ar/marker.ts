import { assetUrl } from '../catalog';

export const marker = {
  name: 'QR-метка ТМХ',
  imageUrl: assetUrl('markers/qr-full.png'),
  patternUrl: assetUrl('markers/qr-full.patt'),
  // Inner square 920 px / outer black square 1840 px in the 2000 px image.
  patternRatio: 0.5,
};
