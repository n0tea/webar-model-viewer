import { assetUrl } from '../catalog';

export const marker = {
  name: 'QR-метка ТМХ',
  imageUrl: assetUrl('markers/qr-new.png'),
  patternUrl: assetUrl('markers/qr-new.patt'),
  // Inner square 1600 px / outer black square 1840 px in the 2000 px image.
  patternRatio: 1600 / 1840,
};
