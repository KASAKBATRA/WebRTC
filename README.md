# Real-Time WebRTC Voice Bot Pipeline

A production-grade real-time AI calling system with WebRTC, featuring:
- Live voice streaming
- Barge-in interruption support
- Low-latency audio processing
- Deterministic media pipelines

## Architecture

```
Browser Microphone → WebRTC → Node.js Media Server
                                    ↓
                              Fake STT (Streaming)
                                    ↓
                               Bot Logic
                                    ↓
                          Fake TTS (PCM Streaming)
                                    ↓
                    Node.js Media Server → WebRTC
                                    ↓
                            Browser Speaker
```

## Requirements

- Node.js >= 18
- Modern browser with WebRTC support

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

## Features

- ✅ WebRTC peer connections
- ✅ Raw PCM audio processing (16kHz, mono, 16-bit)
- ✅ Voice activity detection
- ✅ Streaming STT simulation
- ✅ Streaming TTS with PCM generation
- ✅ Barge-in cancellation (<300ms)
- ✅ State machine (IDLE → LISTENING → PROCESSING → SPEAKING → INTERRUPTED)
- ✅ Session isolation
- ✅ Performance logging

## State Machine

- **IDLE**: Initial state
- **LISTENING**: Capturing user audio
- **PROCESSING**: Fake STT processing
- **SPEAKING**: Bot playing TTS
- **INTERRUPTED**: User barged in during bot speech

## Testing Barge-In

1. Click "Start Call"
2. Speak into microphone
3. Bot will respond with synthetic audio
4. Speak again while bot is talking
5. Bot should stop immediately (<300ms)

## Performance Metrics

The system logs:
- WebRTC connection time
- STT response latency
- TTS streaming start time
- Barge-in cancellation latency
