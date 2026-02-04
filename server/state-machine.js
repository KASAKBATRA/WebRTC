/**
 * Session State Machine
 * Manages session states: IDLE → LISTENING → PROCESSING → SPEAKING → INTERRUPTED
 */

export const SessionState = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED'
};

export class StateMachine {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.state = SessionState.IDLE;
    this.history = [];
    this.listeners = [];
  }

  /**
   * Transition to new state
   */
  transition(newState, metadata = {}) {
    const oldState = this.state;
    
    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[StateMachine:${this.sessionId}] Invalid transition: ${oldState} → ${newState}`);
      return false;
    }

    this.state = newState;
    const transition = {
      from: oldState,
      to: newState,
      timestamp: Date.now(),
      metadata
    };
    
    this.history.push(transition);
    console.log(`[StateMachine:${this.sessionId}] ${oldState} → ${newState}`, metadata);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(transition));
    
    return true;
  }

  /**
   * Validate state transition
   */
  isValidTransition(from, to) {
    const validTransitions = {
      [SessionState.IDLE]: [SessionState.LISTENING],
      [SessionState.LISTENING]: [SessionState.PROCESSING, SessionState.IDLE],
      [SessionState.PROCESSING]: [SessionState.SPEAKING, SessionState.LISTENING, SessionState.IDLE],
      [SessionState.SPEAKING]: [SessionState.INTERRUPTED, SessionState.LISTENING, SessionState.IDLE],
      [SessionState.INTERRUPTED]: [SessionState.LISTENING, SessionState.IDLE]
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if in specific state
   */
  is(state) {
    return this.state === state;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get state history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Reset to IDLE
   */
  reset() {
    this.transition(SessionState.IDLE, { reason: 'reset' });
  }
}
