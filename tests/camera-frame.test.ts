import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCameraFrame, TRACKING_SIZE } from '../src/ar/camera-frame.ts';

test('camera projection removes padding without stretching portrait or landscape frames', () => {
  for (const [width, height] of [[480, 640], [640, 480], [720, 1280], [1280, 720], [1920, 1080], [640, 640]]) {
    const frame = getCameraFrame(width, height)!;
    assert(Math.abs(frame.width / frame.height - width / height) < 1e-12);
    assert.equal(frame.x * 2 + frame.width, TRACKING_SIZE);
    assert.equal(frame.y * 2 + frame.height, TRACKING_SIZE);
    assert(Math.abs(frame.projectionX / frame.projectionY - height / width) < 1e-12);
    // Image points anywhere in the original video must project to the same NDC
    // after drawing into the tracker and removing its padding from projection.
    for (const [x, y] of [[0, 0], [width / 2, height / 2], [width, height], [width * 0.23, height * 0.81]]) {
      const trackedX = frame.x + x / width * frame.width;
      const trackedY = frame.y + y / height * frame.height;
      const projectedX = (trackedX / TRACKING_SIZE * 2 - 1) * frame.projectionX;
      const projectedY = (trackedY / TRACKING_SIZE * 2 - 1) * frame.projectionY;
      assert(Math.abs(projectedX - (x / width * 2 - 1)) < 1e-12);
      assert(Math.abs(projectedY - (y / height * 2 - 1)) < 1e-12);
    }
  }
});

test('camera frame ignores missing video metadata', () => {
  for (const [width, height] of [[0, 0], [640, 0], [-1, 480], [NaN, 480]]) {
    assert.equal(getCameraFrame(width, height), undefined);
  }
});
