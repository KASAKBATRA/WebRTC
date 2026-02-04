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
      this.audioSource.onData({
        samples: samples,
        sampleRate: sampleRate,
        bitsPerSample: 16,
        channelCount: 1,
        numberOfFrames: samples.length
      });
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
