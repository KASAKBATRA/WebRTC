/**
 * Fake TTS (Text-to-Speech) Generator
 * Generates streaming synthetic audio (sine wave PCM)
 */

export class FakeTTS {
  constructor() {
    this.sampleRate = 16000; // 16kHz
    this.channels = 1; // Mono
    this.bitsPerSample = 16;
    this.frameSize = 320; // 20ms at 16kHz = 320 samples
    this.frameDurationMs = 20;
    
    // Sine wave parameters
    this.baseFrequency = 440; // A4 note
    this.phase = 0;
  }

  /**
   * Generate streaming PCM audio for given text
   * @param {string} text - Text to convert to speech
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @returns {AsyncGenerator<Buffer>} - Stream of PCM chunks (640 bytes each)
   */
  async *generateAudioStream(text, signal) {
    // Calculate duration based on text length (simulate speech rate)
    const wordsPerSecond = 3;
    const words = text.split(' ').length;
    const durationSeconds = Math.max(2, words / wordsPerSecond);
    const totalFrames = Math.floor(durationSeconds * 1000 / this.frameDurationMs);

    // Vary frequency based on text for variety
    const frequency = this.baseFrequency + (text.length * 10 % 200);
    
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Check for cancellation
      if (signal?.aborted) {
        console.log('[TTS] Generation cancelled');
        return;
      }

      // Generate 20ms PCM frame
      const pcmFrame = this.generateFrame(frequency);
      
      // Stream with realistic timing
      await this.delay(this.frameDurationMs);
      
      yield pcmFrame;
    }
  }

  /**
   * Generate a single 20ms PCM frame (640 bytes)
   * @param {number} frequency - Sine wave frequency
   * @returns {Buffer} - PCM data
   */
  generateFrame(frequency) {
    const buffer = Buffer.alloc(this.frameSize * 2); // 2 bytes per sample
    const angularFrequency = 2 * Math.PI * frequency / this.sampleRate;

    for (let i = 0; i < this.frameSize; i++) {
      // Generate sine wave sample with higher amplitude for audibility
      const sample = Math.sin(this.phase) * 0.7; // 70% amplitude for clear audio
      const intSample = Math.floor(sample * 32767); // Convert to 16-bit integer
      
      buffer.writeInt16LE(intSample, i * 2);
      
      this.phase += angularFrequency;
      if (this.phase > 2 * Math.PI) {
        this.phase -= 2 * Math.PI;
      }
    }

    return buffer;
  }

  /**
   * Generate complete audio buffer (for testing)
   * @param {string} text - Text to convert
   * @returns {Buffer} - Complete PCM buffer
   */
  async generateCompleteAudio(text) {
    const chunks = [];
    const abortController = new AbortController();
    
    for await (const chunk of this.generateAudioStream(text, abortController.signal)) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Delay helper for realistic streaming
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset phase for new generation
   */
  reset() {
    this.phase = 0;
  }

  /**
   * Get audio format info
   */
  getFormat() {
    return {
      sampleRate: this.sampleRate,
      channels: this.channels,
      bitsPerSample: this.bitsPerSample,
      frameSize: this.frameSize,
      frameDurationMs: this.frameDurationMs
    };
  }
}
