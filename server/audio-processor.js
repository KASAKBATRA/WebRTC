/**
 * Audio Processor
 * Handles raw PCM audio conversion and frame extraction
 */

export class AudioProcessor {
  constructor() {
    this.targetSampleRate = 16000; // 16kHz
    this.targetChannels = 1; // Mono
    this.frameDuration = 20; // 20ms
    this.frameSize = (this.targetSampleRate * this.frameDuration) / 1000; // 320 samples
    this.bytesPerFrame = this.frameSize * 2; // 640 bytes (16-bit PCM)
    
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Process incoming audio data and extract 20ms frames
   * @param {Buffer} audioData - Raw PCM audio data
   * @param {number} sourceSampleRate - Source sample rate (e.g., 48000)
   * @param {number} sourceChannels - Source channel count
   * @returns {Buffer[]} - Array of 20ms PCM frames (16kHz, mono)
   */
  processAudioData(audioData, sourceSampleRate = 48000, sourceChannels = 1) {
    // Resample if needed
    let processedData = audioData;
    
    if (sourceSampleRate !== this.targetSampleRate) {
      processedData = this.simpleResample(audioData, sourceSampleRate, this.targetSampleRate);
    }
    
    // Convert to mono if needed
    if (sourceChannels > 1) {
      processedData = this.convertToMono(processedData, sourceChannels);
    }
    
    // Append to buffer
    this.buffer = Buffer.concat([this.buffer, processedData]);
    
    const frames = [];
    
    // Extract complete frames
    while (this.buffer.length >= this.bytesPerFrame) {
      const frame = this.buffer.slice(0, this.bytesPerFrame);
      frames.push(frame);
      this.buffer = this.buffer.slice(this.bytesPerFrame);
    }
    
    return frames;
  }

  /**
   * Simple linear interpolation resampling
   * @param {Buffer} input - Input PCM buffer
   * @param {number} inputRate - Input sample rate
   * @param {number} outputRate - Output sample rate
   * @returns {Buffer} - Resampled PCM buffer
   */
  simpleResample(input, inputRate, outputRate) {
    const inputSamples = input.length / 2;
    const outputSamples = Math.floor(inputSamples * outputRate / inputRate);
    const output = Buffer.alloc(outputSamples * 2);
    
    for (let i = 0; i < outputSamples; i++) {
      const srcIndex = i * inputRate / outputRate;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      const sample1 = input.readInt16LE(srcIndexFloor * 2);
      const sample2 = input.readInt16LE(srcIndexCeil * 2);
      const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);
      
      output.writeInt16LE(interpolated, i * 2);
    }
    
    return output;
  }

  /**
   * Convert stereo/multi-channel to mono
   * @param {Buffer} input - Input PCM buffer
   * @param {number} channels - Number of channels
   * @returns {Buffer} - Mono PCM buffer
   */
  convertToMono(input, channels) {
    const sampleCount = input.length / (2 * channels);
    const output = Buffer.alloc(sampleCount * 2);
    
    for (let i = 0; i < sampleCount; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += input.readInt16LE((i * channels + ch) * 2);
      }
      output.writeInt16LE(Math.round(sum / channels), i * 2);
    }
    
    return output;
  }

  /**
   * Clear buffer
   */
  clearBuffer() {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Get format info
   */
  getFormat() {
    return {
      sampleRate: this.targetSampleRate,
      channels: this.targetChannels,
      frameDuration: this.frameDuration,
      frameSize: this.frameSize,
      bytesPerFrame: this.bytesPerFrame
    };
  }
}
