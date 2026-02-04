/**
 * Fake STT (Speech-to-Text) Simulator
 * Simulates streaming speech recognition with voice activity detection
 */

export class FakeSTT {
  constructor() {
    this.isProcessing = false;
    this.voiceBuffer = [];
    this.silenceFrames = 0;
    this.voiceFrames = 0;
    this.partialText = '';
    
    // Voice Activity Detection parameters
    this.VOICE_THRESHOLD = 0.02; // RMS threshold for voice detection
    this.VOICE_START_FRAMES = 25; // ~500ms at 20ms frames
    this.SILENCE_END_FRAMES = 15; // ~300ms silence to finalize
    
    // Hardcoded responses for simulation
    this.responses = [
      "hello",
      "how are you",
      "what's the weather",
      "tell me a joke",
      "goodbye"
    ];
    this.responseIndex = 0;
  }

  /**
   * Calculate RMS (Root Mean Square) for voice activity detection
   */
  calculateRMS(pcmData) {
    let sum = 0;
    const sampleCount = pcmData.length / 2; // 16-bit samples = 2 bytes each
    for (let i = 0; i < sampleCount; i++) {
      const sample = pcmData.readInt16LE(i * 2) / 32768.0; // Normalize to -1 to 1
      sum += sample * sample;
    }
    return Math.sqrt(sum / sampleCount);
  }

  /**
   * Process audio frame and detect voice activity
   * @param {Buffer} audioFrame - 20ms PCM frame (640 bytes)
   * @returns {Object|null} - Transcript event or null
   */
  processFrame(audioFrame) {
    const rms = this.calculateRMS(audioFrame);
    const hasVoice = rms > this.VOICE_THRESHOLD;

    if (hasVoice) {
      this.voiceFrames++;
      this.silenceFrames = 0;
      
      // Start processing after detecting enough voice
      if (this.voiceFrames === this.VOICE_START_FRAMES && !this.isProcessing) {
        this.isProcessing = true;
        this.partialText = this.getNextResponse().substring(0, 3);
        return {
          type: 'partial',
          text: this.partialText,
          timestamp: Date.now()
        };
      }
      
      // Emit progressive partial updates
      if (this.isProcessing && this.voiceFrames % 10 === 0) {
        const fullText = this.getNextResponse();
        const progress = Math.min(this.voiceFrames - this.VOICE_START_FRAMES, fullText.length);
        this.partialText = fullText.substring(0, progress);
        return {
          type: 'partial',
          text: this.partialText,
          timestamp: Date.now()
        };
      }
    } else {
      // Silence detected
      if (this.isProcessing) {
        this.silenceFrames++;
        
        // Finalize after enough silence
        if (this.silenceFrames >= this.SILENCE_END_FRAMES) {
          const finalText = this.getNextResponse();
          this.responseIndex = (this.responseIndex + 1) % this.responses.length;
          this.reset();
          
          return {
            type: 'final',
            text: finalText,
            timestamp: Date.now()
          };
        }
      }
    }

    return null;
  }

  /**
   * Get next hardcoded response
   */
  getNextResponse() {
    return this.responses[this.responseIndex];
  }

  /**
   * Reset STT state
   */
  reset() {
    this.isProcessing = false;
    this.voiceBuffer = [];
    this.silenceFrames = 0;
    this.voiceFrames = 0;
    this.partialText = '';
  }

  /**
   * Get current processing state
   */
  getState() {
    return {
      isProcessing: this.isProcessing,
      voiceFrames: this.voiceFrames,
      silenceFrames: this.silenceFrames,
      partialText: this.partialText
    };
  }
}
