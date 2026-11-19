import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('gearbox GLB retains synchronized object animation and Draco geometry', () => {
  const buffer = readFileSync(new URL('../public/models/worm-gearbox-c100.glb', import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.byteLength);
  const doc = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  assert(doc.extensionsUsed.includes('KHR_draco_mesh_compression'));
  assert.equal(doc.nodes.length, 66);
  assert.equal(doc.animations.length, 1);
  const clip = doc.animations[0];
  assert.equal(clip.name, 'Сборка редуктора');
  assert.equal(new Set(clip.channels.map((channel: any) => channel.target.node)).size, 50);
  assert(clip.channels.some((channel: any) => channel.target.path === 'rotation'));
  assert(clip.channels.some((channel: any) => channel.target.path === 'translation'));
  for (const channel of clip.channels) {
    assert(doc.nodes[channel.target.node]);
    const time = doc.accessors[clip.samplers[channel.sampler].input];
    assert(time.count >= 2);
    assert.equal(time.min[0], 0);
    assert(Math.abs(time.max[0] - 1199 / 30) < 0.001);
  }
});
