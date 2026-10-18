const { EventEmitter } = require('events');

class GestureEngine extends EventEmitter {
  constructor() {
    super();
    this.isActive = false;
    this.cameraIndex = 0;
    this.sensitivity = 1.0;
    this.smoothing = 0.2;
    this.mirrorX = true;
    this.mirrorY = false;
    this.lastGesture = null;
    this.lastHandPosition = null;
    this.gestureHistory = [];
    this.maxHistoryLength = 50;
    this.gestureCallbacks = new Map();
    this.settings = {
      enableClickGestures: true,
      enableDragGestures: true,
      enableSwipeGestures: true,
      enableCustomGestures: true,
      pinchThreshold: 0.05,
      fistThreshold: 0.15,
      swipeVelocityThreshold: 0.3,
      palmOpenThreshold: 0.7,
      debugMode: false
    };
    this._registerDefaultGestures();
  }

  _registerDefaultGestures() {
    this.registerGesture('pinch', { description: 'Pinch thumb and index finger to click', action: 'click' });
    this.registerGesture('fist', { description: 'Close fist to grab/drag', action: 'grab' });
    this.registerGesture('palm', { description: 'Open palm to release', action: 'release' });
    this.registerGesture('point_up', { description: 'Point index finger up to scroll up', action: 'scroll_up' });
    this.registerGesture('point_down', { description: 'Point index finger down to scroll down', action: 'scroll_down' });
    this.registerGesture('swipe_left', { description: 'Swipe hand left', action: 'navigate_back' });
    this.registerGesture('swipe_right', { description: 'Swipe hand right', action: 'navigate_forward' });
    this.registerGesture('thumbs_up', { description: 'Thumbs up gesture', action: 'confirm' });
    this.registerGesture('peace', { description: 'Peace sign (two fingers up)', action: 'toggle_menu' });
  }

  registerGesture(name, config) {
    this.gestureCallbacks.set(name, { ...config, registeredAt: Date.now() });
    this.emit('gesture_registered', { name, config });
  }

  unregisterGesture(name) {
    this.gestureCallbacks.delete(name);
    this.emit('gesture_unregistered', { name });
  }

  configure(settings) {
    this.settings = { ...this.settings, ...settings };
    this.emit('settings_updated', this.settings);
    return this.settings;
  }

  getSettings() {
    return { ...this.settings };
  }

  getRegisteredGestures() {
    const gestures = {};
    for (const [name, config] of this.gestureCallbacks) {
      gestures[name] = { ...config };
    }
    return gestures;
  }

  start() {
    this.isActive = true;
    this.gestureHistory = [];
    this.emit('started');
    return { active: true };
  }

  stop() {
    this.isActive = false;
    this.lastGesture = null;
    this.lastHandPosition = null;
    this.emit('stopped');
    return { active: false };
  }

  processHandLandmarks(landmarks, imageWidth = 640, imageHeight = 480) {
    if (!this.isActive || !landmarks || landmarks.length === 0) return null;
    const hand = landmarks[0];
    if (!hand || hand.length < 21) return null;
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerMcps = [2, 5, 9, 13, 17];
    const fingerPips = [3, 6, 10, 14, 18];
    const wrist = hand[0];
    const fingerStates = [];
    for (let i = 0; i < 5; i++) {
      const tip = hand[fingerTips[i]];
      const pip = hand[fingerPips[i]];
      const mcp = hand[fingerMcps[i]];
      let isExtended;
      if (i === 0) {
        isExtended = Math.abs(tip.x - mcp.x) > Math.abs(pip.x - mcp.x) * 0.8;
      } else {
        isExtended = tip.y < pip.y;
      }
      fingerStates.push({ finger: ['thumb', 'index', 'middle', 'ring', 'pinky'][i], isExtended, tip, pip, mcp });
    }
    const extendedCount = fingerStates.filter(f => f.isExtended).length;
    const gesture = this._classifyGesture(hand, fingerStates, wrist, extendedCount);
    const cursorX = this.mirrorX ? 1 - hand[8].x : hand[8].x;
    const cursorY = this.mirrorY ? 1 - hand[8].y : hand[8].y;
    const position = {
      x: cursorX * imageWidth * this.sensitivity,
      y: cursorY * imageHeight * this.sensitivity,
      rawX: hand[8].x, rawY: hand[8].y,
      smoothedX: this._smoothValue(cursorX * imageWidth, 'x'),
      smoothedY: this._smoothValue(cursorY * imageHeight, 'y')
    };
    const event = { gesture, position, fingerStates, extendedCount, timestamp: Date.now(), landmarks: hand };
    this.gestureHistory.push(event);
    if (this.gestureHistory.length > this.maxHistoryLength) this.gestureHistory.shift();
    if (gesture.name !== this.lastGesture?.name) {
      this.emit('gesture_changed', event);
      if (this.settings.debugMode) this.emit('gesture_debug', event);
    }
    this.lastGesture = gesture;
    this.lastHandPosition = position;
    const callback = this.gestureCallbacks.get(gesture.name);
    if (callback) {
      this.emit('gesture_action', { gesture: gesture.name, action: callback.action, position, event });
    }
    return event;
  }

  _classifyGesture(hand, fingerStates, wrist, extendedCount) {
    const thumbIndexDist = this._distance(hand[4], hand[8]);
    const indexMiddleDist = this._distance(hand[8], hand[12]);
    if (thumbIndexDist < this.settings.pinchThreshold && extendedCount <= 2) {
      return { name: 'pinch', confidence: 1 - (thumbIndexDist / this.settings.pinchThreshold), type: 'click' };
    }
    if (extendedCount === 0) {
      return { name: 'fist', confidence: 0.9, type: 'grab' };
    }
    if (extendedCount >= 4 && fingerStates[0].isExtended) {
      return { name: 'palm', confidence: 0.9, type: 'release' };
    }
    if (extendedCount === 1 && fingerStates[1].isExtended && !fingerStates[0].isExtended) {
      const indexTip = hand[8];
      const indexMcp = hand[5];
      if (indexTip.y < indexMcp.y - 0.05) return { name: 'point_up', confidence: 0.85, type: 'scroll' };
      if (indexTip.y > indexMcp.y + 0.05) return { name: 'point_down', confidence: 0.85, type: 'scroll' };
      return { name: 'point', confidence: 0.8, type: 'cursor' };
    }
    if (extendedCount === 2 && fingerStates[1].isExtended && fingerStates[2].isExtended) {
      return { name: 'peace', confidence: 0.85, type: 'menu' };
    }
    if (fingerStates[0].isExtended && !fingerStates[1].isExtended && !fingerStates[2].isExtended && !fingerStates[3].isExtended && !fingerStates[4].isExtended) {
      return { name: 'thumbs_up', confidence: 0.85, type: 'confirm' };
    }
    if (this.gestureHistory.length >= 5) {
      const recent = this.gestureHistory.slice(-5);
      const dx = recent[4].position.x - recent[0].position.x;
      const velocity = Math.abs(dx) / ((recent[4].timestamp - recent[0].timestamp) / 1000);
      if (velocity > this.settings.swipeVelocityThreshold) {
        return { name: dx > 0 ? 'swipe_right' : 'swipe_left', confidence: Math.min(velocity / 1, 1), type: 'swipe' };
      }
    }
    return { name: 'unknown', confidence: 0.5, type: 'none' };
  }

  _distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow((p1.z || 0) - (p2.z || 0), 2));
  }

  _smoothValue(value, axis) {
    if (!this.lastHandPosition) return value;
    const lastValue = axis === 'x' ? this.lastHandPosition.x : this.lastHandPosition.y;
    return lastValue + (value - lastValue) * this.smoothing;
  }

  detectPinch(landmarks) {
    if (!landmarks || landmarks.length === 0) return false;
    const hand = landmarks[0];
    if (!hand || hand.length < 21) return false;
    const dist = this._distance(hand[4], hand[8]);
    return dist < this.settings.pinchThreshold;
  }

  detectFist(landmarks) {
    if (!landmarks || landmarks.length === 0) return false;
    const hand = landmarks[0];
    if (!hand || hand.length < 21) return false;
    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];
    let closedCount = 0;
    for (let i = 0; i < 4; i++) {
      if (hand[tips[i]].y > hand[mcps[i]].y) closedCount++;
    }
    return closedCount >= 3;
  }

  detectOpenPalm(landmarks) {
    if (!landmarks || landmarks.length === 0) return false;
    const hand = landmarks[0];
    if (!hand || hand.length < 21) return false;
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    let openCount = 0;
    for (let i = 0; i < 4; i++) {
      if (hand[tips[i]].y < hand[pips[i]].y) openCount++;
    }
    return openCount >= 3;
  }

  getGestureHistory() { return [...this.gestureHistory]; }
  clearHistory() { this.gestureHistory = []; this.emit('history_cleared'); }
  getLastGesture() { return this.lastGesture; }
  getLastPosition() { return this.lastHandPosition; }

  getState() {
    return {
      active: this.isActive, lastGesture: this.lastGesture, lastPosition: this.lastHandPosition,
      historyLength: this.gestureHistory.length, registeredGestures: this.gestureCallbacks.size,
      settings: this.settings
    };
  }
}

module.exports = GestureEngine;
