import test from 'node:test';
import assert from 'node:assert/strict';
import { isTouchDevice, supportMessage, videoSupportProblem } from '../src/features/video/browserSupport';

const yes = { isConfigSupported: async () => ({ supported: true }) };
const no = { isConfigSupported: async () => ({ supported: false }) };

test('a browser without WebCodecs is told at the start that it cannot make the MP4', async () => {
  assert.equal(await videoSupportProblem({}), 'no-encoder');
  assert.equal(await videoSupportProblem({ VideoEncoder: no, AudioEncoder: yes, VideoFrame: 1, AudioData: 1 }), 'no-h264');
  assert.equal(await videoSupportProblem({ VideoEncoder: yes, AudioEncoder: no, VideoFrame: 1, AudioData: 1 }), 'no-aac');
  assert.equal(await videoSupportProblem({ VideoEncoder: yes, AudioEncoder: yes, VideoFrame: 1, AudioData: 1 }), null);
  assert.match(supportMessage('no-encoder', false)!, /Chrome ya da Edge/);
});

test('phones and iPads get a gentle hint; a capable desktop gets nothing', () => {
  assert.equal(isTouchDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), true);
  assert.equal(isTouchDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true);
  assert.equal(isTouchDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', maxTouchPoints: 0 }), false);
  assert.equal(supportMessage(null, false), null);
  assert.match(supportMessage(null, true)!, /bilgisayarda/);
});
