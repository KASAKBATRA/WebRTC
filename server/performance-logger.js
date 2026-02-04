/**
 * Performance Logger
 * Tracks and logs performance metrics for each session
 */

export class PerformanceLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logs = [];
    this.metrics = {
      webrtcConnectionTime: null,
      sttLatencies: [],
      ttsStreamingStartTime: null,
      bargeInLatencies: []
    };
  }

  /**
   * Log an event with timestamp
   */
  logEvent(eventType, data = {}) {
    const log = {
      eventType,
      timestamp: Date.now(),
      data
    };
    
    this.logs.push(log);
    
    // Update metrics based on event type
    this.updateMetrics(eventType, data);
    
    return log;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(eventType, data) {
    switch (eventType) {
      case 'webrtc_connected':
        this.metrics.webrtcConnectionTime = data.connectionTime;
        console.log(`[Metrics:${this.sessionId}] WebRTC connection: ${data.connectionTime}ms`);
        break;
        
      case 'stt_final':
        if (data.latency) {
          this.metrics.sttLatencies.push(data.latency);
          console.log(`[Metrics:${this.sessionId}] STT latency: ${data.latency}ms`);
        }
        break;
        
      case 'tts_first_chunk':
        this.metrics.ttsStreamingStartTime = data.latency;
        console.log(`[Metrics:${this.sessionId}] TTS streaming start: ${data.latency}ms`);
        break;
        
      case 'barge_in':
        this.metrics.bargeInLatencies.push(data.latency);
        console.log(`[Metrics:${this.sessionId}] Barge-in latency: ${data.latency}ms`);
        
        // Highlight if exceeds requirement
        if (data.latency > 300) {
          console.warn(`[Metrics:${this.sessionId}] ⚠️  BARGE-IN LATENCY EXCEEDS 300ms!`);
        }
        break;
    }
  }

  /**
   * Get all logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgSttLatency: this.calculateAverage(this.metrics.sttLatencies),
      avgBargeInLatency: this.calculateAverage(this.metrics.bargeInLatencies),
      maxBargeInLatency: Math.max(...this.metrics.bargeInLatencies, 0),
      bargeInCount: this.metrics.bargeInLatencies.length
    };
  }

  /**
   * Calculate average
   */
  calculateAverage(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * Print summary report
   */
  printSummary() {
    const metrics = this.getMetrics();
    
    console.log(`\n=== Performance Summary for Session ${this.sessionId} ===`);
    console.log(`WebRTC Connection Time: ${metrics.webrtcConnectionTime}ms`);
    console.log(`TTS Streaming Start: ${metrics.ttsStreamingStartTime}ms`);
    console.log(`Average STT Latency: ${metrics.avgSttLatency.toFixed(2)}ms`);
    console.log(`Average Barge-In Latency: ${metrics.avgBargeInLatency.toFixed(2)}ms`);
    console.log(`Max Barge-In Latency: ${metrics.maxBargeInLatency}ms`);
    console.log(`Barge-In Count: ${metrics.bargeInCount}`);
    console.log(`Total Events: ${this.logs.length}`);
    console.log(`================================================\n`);
  }
}
