/**
 * WebRTC Media Server
 * Main server handling WebRTC connections, signaling, and media processing
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import wrtc from 'wrtc';
import { SessionManager } from './session-manager.js';
import { AudioProcessor } from './audio-processor.js';
import { WebRTCAudioHandler } from './webrtc-audio-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Session manager
const sessionManager = new SessionManager();

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 WebRTC Voice Bot Server running on http://localhost:${PORT}`);
  console.log(`📊 Open browser to start voice call`);
});

// WebSocket server for signaling
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📡 WebSocket client connected');
  
  const sessionId = generateSessionId();
  let session = null;
  let peerConnection = null;
  let audioProcessor = new AudioProcessor();
  let audioHandler = null;
  const connectionStartTime = Date.now();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'offer':
          await handleOffer(data.offer);
          break;
          
        case 'ice-candidate':
          await handleIceCandidate(data.candidate);
          break;
          
        case 'close':
          handleClose();
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });

  /**
   * Handle WebRTC offer from browser
   */
  async function handleOffer(offer) {
    console.log(`[${sessionId}] Received offer`);
    
    // Create peer connection
    peerConnection = new wrtc.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create audio handler
    audioHandler = new WebRTCAudioHandler(peerConnection);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[${sessionId}] Connection state: ${peerConnection.connectionState}`);
      
      if (peerConnection.connectionState === 'connected') {
        const connectionTime = Date.now() - connectionStartTime;
        console.log(`[${sessionId}] ✅ WebRTC connected in ${connectionTime}ms`);
        
        if (session) {
          session.logger.logEvent('webrtc_connected', { connectionTime });
        }
      }
    };

    // Handle incoming audio track
    peerConnection.ontrack = (event) => {
      console.log(`[${sessionId}] Received track:`, event.track.kind);
      
      if (event.track.kind === 'audio') {
        handleIncomingAudioTrack(event.track);
      }
    };

    // Create audio source and track
    const audioTrack = audioHandler.createAudioSource();

    // Set remote description (offer)
    await peerConnection.setRemoteDescription(offer);

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer back to browser
    ws.send(JSON.stringify({
      type: 'answer',
      answer: peerConnection.localDescription
    }));

    // Create session with audio handler
    session = sessionManager.createSession(sessionId, peerConnection, audioHandler);
    await session.start();
  }

  /**
   * Handle incoming audio track from browser microphone
   */
  function handleIncomingAudioTrack(track) {
    console.log(`[${sessionId}] Setting up audio sink for incoming track`);
    
    audioHandler.attachAudioSink(track, (audioData) => {
      if (!session || !session.isProcessingAudio) {
        return;
      }
      
      const { samples, sampleRate, channelCount } = audioData;
      
      // Convert Int16Array to Buffer
      const pcmBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
      
      // Process and resample to 16kHz, extract 20ms frames
      const frames = audioProcessor.processAudioData(pcmBuffer, sampleRate, channelCount);
      
      // Send frames to session for STT processing
      frames.forEach(frame => {
        if (session) {
          session.processAudioFrame(frame);
        }
      });
    });
  }

  /**
   * Handle ICE candidate
   */
  async function handleIceCandidate(candidate) {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  /**
   * Handle close
   */
  function handleClose() {
    console.log(`[${sessionId}] Client disconnected`);
    
    if (session) {
      session.logger.printSummary();
      sessionManager.removeSession(sessionId);
    }
    
    if (audioHandler) {
      audioHandler.destroy();
    }
    
    if (peerConnection) {
      peerConnection.close();
    }
  }

  ws.on('close', () => {
    handleClose();
  });

  ws.on('error', (error) => {
    console.error(`[${sessionId}] WebSocket error:`, error);
  });
});

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * API endpoints
 */

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessions: sessionManager.getSessionCount(),
    uptime: process.uptime()
  });
});

// Get session metrics
app.get('/metrics/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId);
  if (session) {
    res.json(session.getMetrics());
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  // Close all sessions
  sessionManager.getAllSessions().forEach(session => {
    session.logger.printSummary();
  });
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('✨ Server initialized');
console.log('📝 Features:');
console.log('   ✅ WebRTC peer connections');
console.log('   ✅ Raw PCM audio processing (16kHz, mono, 16-bit)');
console.log('   ✅ Voice activity detection');
console.log('   ✅ Streaming STT simulation');
console.log('   ✅ Streaming TTS with PCM generation');
console.log('   ✅ Barge-in cancellation (<300ms)');
console.log('   ✅ State machine (IDLE → LISTENING → PROCESSING → SPEAKING → INTERRUPTED)');
console.log('   ✅ Session isolation');
console.log('   ✅ Performance logging');
