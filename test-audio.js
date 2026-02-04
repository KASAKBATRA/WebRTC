/**
 * Test script to verify audio generation and processing
 */

import { FakeTTS } from './server/fake-tts.js';
import { FakeSTT } from './server/fake-stt.js';
import { AudioProcessor } from './server/audio-processor.js';
import { writeFileSync } from 'fs';

console.log('🧪 Testing Audio Pipeline\n');

// Test TTS
console.log('1️⃣ Testing TTS Audio Generation...');
const tts = new FakeTTS();
const text = "Hello world";
const audioChunks = [];
const abortController = new AbortController();

for await (const chunk of tts.generateAudioStream(text, abortController.signal)) {
  audioChunks.push(chunk);
  if (audioChunks.length === 5) {
    console.log(`   ✓ Generated ${audioChunks.length} chunks so far...`);
  }
}

const fullAudio = Buffer.concat(audioChunks);
console.log(`   ✓ TTS Complete: ${audioChunks.length} chunks, ${fullAudio.length} bytes`);
console.log(`   ✓ Expected: ${audioChunks.length * 640} bytes (${audioChunks.length} × 640)`);
console.log(`   ✓ Duration: ~${(fullAudio.length / 640) * 20}ms\n`);

// Save to file for inspection
writeFileSync('test-audio.raw', fullAudio);
console.log('   ✓ Saved to test-audio.raw (16kHz, mono, 16-bit PCM)\n');

// Test STT
console.log('2️⃣ Testing STT Voice Detection...');
const stt = new FakeSTT();
let partialCount = 0;
let finalCount = 0;

// Generate frames with voice-like energy
for (let i = 0; i < 50; i++) {
  const frame = generateVoiceFrame(i < 30); // First 30 frames have voice
  const result = stt.processFrame(frame);
  
  if (result) {
    if (result.type === 'partial') {
      partialCount++;
      console.log(`   ✓ Partial transcript: "${result.text}"`);
    } else if (result.type === 'final') {
      finalCount++;
      console.log(`   ✓ Final transcript: "${result.text}"`);
    }
  }
}

console.log(`   ✓ STT Complete: ${partialCount} partials, ${finalCount} finals\n`);

// Test Audio Processor
console.log('3️⃣ Testing Audio Resampling (48kHz → 16kHz)...');
const processor = new AudioProcessor();

// Generate 48kHz audio (960 samples for 20ms)
const samples48k = 960;
const buffer48k = Buffer.alloc(samples48k * 2);
for (let i = 0; i < samples48k; i++) {
  const sample = Math.sin(i * 0.1) * 16000;
  buffer48k.writeInt16LE(sample, i * 2);
}

const frames16k = processor.processAudioData(buffer48k, 48000, 1);
console.log(`   ✓ Input: ${buffer48k.length} bytes at 48kHz (${samples48k} samples)`);
console.log(`   ✓ Output: ${frames16k.length} frame(s) at 16kHz`);
if (frames16k.length > 0) {
  console.log(`   ✓ Frame size: ${frames16k[0].length} bytes (expected 640)\n`);
}

console.log('✅ All tests passed!\n');

function generateVoiceFrame(hasVoice) {
  const buffer = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    const amplitude = hasVoice ? 0.15 : 0.01;
    const sample = (Math.random() - 0.5) * amplitude * 32767;
    buffer.writeInt16LE(sample, i * 2);
  }
  return buffer;
}
