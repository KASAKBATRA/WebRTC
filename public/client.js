/**
 * WebRTC Voice Bot Client
 * Browser client handling microphone capture and WebRTC connection
 */

class VoiceBotClient {
  constructor() {
    this.ws = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteAudioElement = null;
    this.isConnected = false;
    
    // UI elements
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.statusDiv = document.getElementById('status');
    this.statusText = document.getElementById('statusText');
    this.logsDiv = document.getElementById('logs');
    
    this.setupEventListeners();
    this.createRemoteAudioElement();
  }

  /**
   * Setup button event listeners
   */
  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startCall());
    this.stopBtn.addEventListener('click', () => this.stopCall());
  }

  /**
   * Create audio element for remote audio playback
   */
  createRemoteAudioElement() {
    this.remoteAudioElement = document.createElement('audio');
    this.remoteAudioElement.autoplay = true;
    this.remoteAudioElement.id = 'remoteAudio';
  }

  /**
   * Start call - capture microphone and establish WebRTC connection
   */
  async startCall() {
    try {
      this.log('Requesting microphone access...', 'info');
      this.updateStatus('connecting', 'Connecting...');
      this.startBtn.disabled = true;

      // Capture microphone
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      this.log('✓ Microphone access granted', 'success');

      // Connect to signaling server
      await this.connectWebSocket();

      // Create peer connection
      await this.createPeerConnection();

      // Add microphone track
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
        this.log(`✓ Added ${track.kind} track`, 'success');
      });

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.log('Sending offer to server...', 'info');
      this.ws.send(JSON.stringify({
        type: 'offer',
        offer: this.peerConnection.localDescription
      }));

    } catch (error) {
      console.error('Error starting call:', error);
      this.log(`✗ Error: ${error.message}`, 'error');
      this.updateStatus('disconnected', 'Error');
      this.startBtn.disabled = false;
    }
  }

  /**
   * Connect to WebSocket signaling server
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.log('✓ WebSocket connected', 'success');
        resolve();
      };

      this.ws.onmessage = async (event) => {
        await this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.log('✗ WebSocket error', 'error');
        reject(error);
      };

      this.ws.onclose = () => {
        this.log('WebSocket disconnected', 'warning');
        if (this.isConnected) {
          this.stopCall();
        }
      };
    });
  }

  /**
   * Create WebRTC peer connection
   */
  async createPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    // Handle remote track (bot audio)
    this.peerConnection.ontrack = (event) => {
      this.log('✓ Receiving bot audio', 'success');
      this.remoteAudioElement.srcObject = event.streams[0];
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.log(`Connection state: ${state}`, 'info');

      switch (state) {
        case 'connected':
          this.updateStatus('connected', 'Connected');
          this.isConnected = true;
          this.stopBtn.disabled = false;
          this.log('🎉 Call established! You can speak now.', 'success');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.updateStatus('disconnected', 'Disconnected');
          this.isConnected = false;
          this.stopBtn.disabled = true;
          this.startBtn.disabled = false;
          break;
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      this.log(`ICE state: ${this.peerConnection.iceConnectionState}`, 'info');
    };
  }

  /**
   * Handle signaling messages from server
   */
  async handleSignalingMessage(message) {
    switch (message.type) {
      case 'answer':
        this.log('✓ Received answer from server', 'success');
        await this.peerConnection.setRemoteDescription(message.answer);
        break;

      case 'ice-candidate':
        if (message.candidate) {
          await this.peerConnection.addIceCandidate(message.candidate);
        }
        break;

      case 'error':
        this.log(`✗ Server error: ${message.error}`, 'error');
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Stop call and cleanup
   */
  stopCall() {
    this.log('Stopping call...', 'info');

    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'close' }));
      this.ws.close();
      this.ws = null;
    }

    // Stop remote audio
    if (this.remoteAudioElement.srcObject) {
      this.remoteAudioElement.srcObject.getTracks().forEach(track => track.stop());
      this.remoteAudioElement.srcObject = null;
    }

    this.isConnected = false;
    this.updateStatus('disconnected', 'Disconnected');
    this.stopBtn.disabled = true;
    this.startBtn.disabled = false;
    this.log('✓ Call ended', 'success');
  }

  /**
   * Update connection status UI
   */
  updateStatus(state, text) {
    this.statusDiv.className = `status ${state}`;
    this.statusText.textContent = text;
  }

  /**
   * Add log entry
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${timestamp}] ${message}`;
    
    this.logsDiv.appendChild(entry);
    this.logsDiv.scrollTop = this.logsDiv.scrollHeight;

    // Limit log entries
    while (this.logsDiv.children.length > 50) {
      this.logsDiv.removeChild(this.logsDiv.firstChild);
    }
  }
}

// Initialize client when page loads
let client;
window.addEventListener('DOMContentLoaded', () => {
  client = new VoiceBotClient();
  console.log('WebRTC Voice Bot Client initialized');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (client && client.isConnected) {
    client.stopCall();
  }
});
