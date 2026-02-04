/**
 * WebRTC Audio Handler
 * Proper implementation of audio extraction and playback using wrtc
 */

import wrtc from 'wrtc';

export class WebRTCAudioHandler {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.audioSource = null;
    this.audioSink = null;
    this.onAudioDataCallback = null;
    this._sentDebugCount = 0;
  }

  /**
   * Create outgoing audio source for sending bot audio to browser
   */
  createAudioSource() {
    this.audioSource = new wrtc.nonstandard.RTCAudioSource();
    const track = this.audioSource.createTrack();
    this.peerConnection.addTrack(track);
    console.log('[WebRTCAudioHandler] Audio source created');
    return track;
  }

  /**
   * Attach audio sink to incoming track to extract PCM audio
   */
  attachAudioSink(track, onAudioData) {
    this.audioSink = new wrtc.nonstandard.RTCAudioSink(track);
    this.onAudioDataCallback = onAudioData;
    
    this.audioSink.ondata = (data) => {
      // data: { samples: Int16Array, sampleRate: number, bitsPerSample: 16, channelCount: number }
      if (this.onAudioDataCallback) {
        this.onAudioDataCallback(data);
      }
    };
    
    console.log('[WebRTCAudioHandler] Audio sink attached');
  }

  /**
   * Send PCM audio to browser via WebRTC
   * @param {Int16Array} samples - Audio samples
   * @param {number} sampleRate - Sample rate (default 16000)
   */
  sendAudio(samples, sampleRate = 16000) {
    if (!this.audioSource) {
      console.error('[WebRTCAudioHandler] Audio source not initialized');
      return false;
    }

    try {
      // wrtc expects 10ms frames (160 samples at 16kHz)
      // Split larger frames into 160-sample chunks
      const CHUNK_SIZE = 160;
      
      for (let i = 0; i < samples.length; i += CHUNK_SIZE) {
        const chunk = samples.slice(i, Math.min(i + CHUNK_SIZE, samples.length));
        // Debug: log first few chunks to verify correct sizing
        if (this._sentDebugCount < 6) {
          console.log('[WebRTCAudioHandler] Sending chunk', this._sentDebugCount + 1, 'frames:', chunk.length, 'sampleRate:', sampleRate);
          this._sentDebugCount++;
        }

        this.audioSource.onData({
          samples: chunk,
          sampleRate: sampleRate,
          bitsPerSample: 16,
          channelCount: 1,
          numberOfFrames: chunk.length
        });
      }
      
      return true;
    } catch (error) {
      console.error('[WebRTCAudioHandler] Error sending audio:', error);
      return false;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioSink) {
      try {
        this.audioSink.stop();
      } catch (e) {
        // Ignore
      }
      this.audioSink = null;
    }
    this.audioSource = null;
    this.onAudioDataCallback = null;
  }
}
