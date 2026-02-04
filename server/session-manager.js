/**
 * Session Manager
 * Handles individual WebRTC sessions with state management and barge-in support
 */

import { StateMachine, SessionState } from './state-machine.js';
import { FakeSTT } from './fake-stt.js';
import { FakeTTS } from './fake-tts.js';
import { PerformanceLogger } from './performance-logger.js';

export class Session {
  constructor(sessionId, peerConnection, audioHandler) {
    this.sessionId = sessionId;
    this.peerConnection = peerConnection;
    this.audioHandler = audioHandler;
    
    // Initialize components
    this.stateMachine = new StateMachine(sessionId);
    this.stt = new FakeSTT();
    this.tts = new FakeTTS();
    this.logger = new PerformanceLogger(sessionId);
    
    // Barge-in control
    this.ttsAbortController = null;
    this.currentTTSStream = null;
    
    // Audio processing
    this.audioBuffer = [];
    this.isProcessingAudio = false;
    
    console.log(`[Session:${sessionId}] Created`);
  }

  /**
   * Start session and begin listening
   */
  async start() {
    this.logger.logEvent('session_start');
    this.stateMachine.transition(SessionState.LISTENING);
    this.startAudioProcessing();
    
    console.log(`[Session:${this.sessionId}] Session started`);
  }

  /**
   * Process incoming audio frames from microphone
   */
  startAudioProcessing() {
    this.isProcessingAudio = true;
    
    // Set up audio track processor
    // Note: In real implementation, we'd use MediaStreamTrackProcessor
    // For this demo, we'll simulate receiving audio frames
    console.log(`[Session:${this.sessionId}] Started audio processing`);
  }

  /**
   * Process a single audio frame (20ms PCM)
   * @param {Buffer} audioFrame - 640 bytes PCM data
   */
  async processAudioFrame(audioFrame) {
    // Check for barge-in during bot speaking
    if (this.stateMachine.is(SessionState.SPEAKING)) {
      const rms = this.stt.calculateRMS(audioFrame);
      if (rms > this.stt.VOICE_THRESHOLD) {
        await this.handleBargeIn();
      }
      return; // Don't process STT while speaking
    }

    // Process STT only in LISTENING state
    if (!this.stateMachine.is(SessionState.LISTENING)) {
      return;
    }

    const result = this.stt.processFrame(audioFrame);
    
    if (result) {
      if (result.type === 'partial') {
        this.logger.logEvent('stt_partial', { text: result.text });
        console.log(`[Session:${this.sessionId}] Partial: "${result.text}"`);
      } else if (result.type === 'final') {
        this.logger.logEvent('stt_final', { text: result.text });
        console.log(`[Session:${this.sessionId}] Final: "${result.text}"`);
        
        // Transition to processing
        this.stateMachine.transition(SessionState.PROCESSING, { text: result.text });
        
        // Generate bot response
        await this.generateResponse(result.text);
      }
    }
  }

  /**
   * Generate bot response using TTS
   */
  async generateResponse(userText) {
    // Simple bot logic - echo with prefix
    const botResponse = `You said: ${userText}`;
    console.log(`[Session:${this.sessionId}] Bot response: "${botResponse}"`);
    
    this.logger.logEvent('tts_start', { text: botResponse });
    
    // Transition to speaking
    this.stateMachine.transition(SessionState.SPEAKING, { text: botResponse });
    
    // Create abort controller for barge-in
    this.ttsAbortController = new AbortController();
    
    try {
      // Stream TTS audio
      const ttsStartTime = Date.now();
      let firstChunk = true;
      let chunkCount = 0;
      const abortSignal = this.ttsAbortController.signal;
      
      for await (const pcmChunk of this.tts.generateAudioStream(botResponse, abortSignal)) {
        if (firstChunk) {
          const latency = Date.now() - ttsStartTime;
          this.logger.logEvent('tts_first_chunk', { latency });
          console.log(`[Session:${this.sessionId}] First TTS chunk in ${latency}ms`);
          firstChunk = false;
        }
        
        chunkCount++;
        
        // Send audio to browser via WebRTC
        await this.sendAudioToBrowser(pcmChunk);
        
        // Check if cancelled
        if (abortSignal.aborted) {
          console.log(`[Session:${this.sessionId}] TTS cancelled after ${chunkCount} chunks`);
          return;
        }
      }
      
      // Finished speaking normally
      console.log(`[Session:${this.sessionId}] TTS complete: ${chunkCount} chunks sent`);
      this.logger.logEvent('tts_complete');
      this.stateMachine.transition(SessionState.LISTENING);
      this.tts.reset();
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`[Session:${this.sessionId}] TTS aborted by barge-in`);
      } else {
        console.error(`[Session:${this.sessionId}] TTS error:`, error);
      }
    }
  }

  /**
   * Handle barge-in (user interrupts bot)
   */
  async handleBargeIn() {
    const bargeInStart = Date.now();
    console.log(`[Session:${this.sessionId}] 🚨 BARGE-IN DETECTED`);
    
    // Transition to interrupted state
    this.stateMachine.transition(SessionState.INTERRUPTED, { timestamp: bargeInStart });
    
    // Cancel TTS immediately
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      // Reinitialize for next TTS call
      this.ttsAbortController = new AbortController();
    }
    
    // Flush audio buffers
    this.audioBuffer = [];
    
    // Reset TTS
    this.tts.reset();
    
    // Transition back to listening
    this.stateMachine.transition(SessionState.LISTENING);
    
    // Reset STT for new input
    this.stt.reset();
    
    const bargeInLatency = Date.now() - bargeInStart;
    this.logger.logEvent('barge_in', { latency: bargeInLatency });
    console.log(`[Session:${this.sessionId}] Barge-in handled in ${bargeInLatency}ms`);
    
    // Verify latency requirement
    if (bargeInLatency > 300) {
      console.warn(`[Session:${this.sessionId}] ⚠️  Barge-in latency exceeded 300ms: ${bargeInLatency}ms`);
    }
  }

  /**
   * Send audio PCM data to browser via WebRTC
   */
  async sendAudioToBrowser(pcmData) {
    if (!this.audioHandler) {
      console.warn(`[Session:${this.sessionId}] No audio handler available`);
      return;
    }
    
    // Convert Buffer to Int16Array
    const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    
    // Send via audio handler
    this.audioHandler.sendAudio(samples, 16000);
  }

  /**
   * Get session metrics
   */
  getMetrics() {
    return {
      sessionId: this.sessionId,
      state: this.stateMachine.getState(),
      history: this.stateMachine.getHistory(),
      logs: this.logger.getLogs()
    };
  }

  /**
   * Close session
   */
  close() {
    console.log(`[Session:${this.sessionId}] Closing`);
    
    // Cancel any ongoing TTS
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    this.isProcessingAudio = false;
    this.logger.logEvent('session_close');
  }
}

/**
 * Session Manager - Manages multiple isolated sessions
 */
export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create new session
   */
  createSession(sessionId, peerConnection, audioHandler) {
    if (this.sessions.has(sessionId)) {
      console.warn(`[SessionManager] Session ${sessionId} already exists`);
      return this.sessions.get(sessionId);
    }

    const session = new Session(sessionId, peerConnection, audioHandler);
    this.sessions.set(sessionId, session);
    console.log(`[SessionManager] Created session ${sessionId}. Total sessions: ${this.sessions.size}`);
    
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove session
   */
  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
      console.log(`[SessionManager] Removed session ${sessionId}. Total sessions: ${this.sessions.size}`);
    }
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount() {
    return this.sessions.size;
  }
}
