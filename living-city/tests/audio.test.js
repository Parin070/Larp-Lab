import { test, expect } from 'vitest';
import { createAudio } from '../src/core/audio.js';

test('audio synthesizer handles headless / missing AudioContext safely', () => {
  const audio = createAudio();
  expect(audio).toBeDefined();

  // In Node/headless test environment without window.AudioContext, none of these should throw
  expect(() => {
    audio.init();
    audio.playCoin();
    audio.playQuestStart();
    audio.playSuccess();
    audio.playQuestFail();
    audio.playVoiceBeep();
    audio.playPickup();
    audio.playTick();
  }).not.toThrow();
});
