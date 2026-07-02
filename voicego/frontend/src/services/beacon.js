// beacon.js — "find each other" locator for the last few metres.
//
// A blind rider can't spot their car; the sighted driver can't pick the rider
// out of a crowd. So the RIDER's phone becomes a beacon: a bright strobe the
// driver can SEE + a haptic buzz. The rider stays put in a safe spot (we never
// steer them into traffic); the driver homes in. Tempo speeds up as the driver
// gets closer (setBeaconIntensity).
//
// NO sound on purpose: the beacon runs while the PIN is read aloud, and a chirp
// would drown out the PIN. Visual strobe (driver-facing) + vibration only.
// All web-only (PWA); vibration is Android-only (silently ignored elsewhere).

let overlay = null;
let loopTimer = null;
let running = false;
let periodMs = 850;     // strobe period; shrinks as the driver approaches
let flashOn = false;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647',
    background: '#ffffff', opacity: '0', pointerEvents: 'none',
    transition: 'opacity 80ms linear',
  });
  document.body.appendChild(overlay);
  return overlay;
}

function tick() {
  if (!running) return;
  const ov = ensureOverlay();
  flashOn = !flashOn;
  ov.style.background = flashOn ? '#ffffff' : '#00b14f';  // white ↔ Grab green
  ov.style.opacity = flashOn ? '1' : '0.15';
  if (flashOn && navigator.vibrate) { try { navigator.vibrate(180); } catch (e) {} }
  loopTimer = setTimeout(tick, periodMs);
}

export function startBeacon() {
  if (running) return;
  running = true;
  ensureOverlay();
  tick();
}

// Map driver→rider distance (metres) to strobe tempo. Closer = faster.
export function setBeaconIntensity(meters) {
  if (!Number.isFinite(meters)) return;
  if (meters > 50) periodMs = 850;
  else if (meters > 25) periodMs = 600;
  else if (meters > 12) periodMs = 380;
  else if (meters > 5) periodMs = 220;
  else periodMs = 130;                    // basically on top of each other
}

export function stopBeacon() {
  running = false;
  if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
  if (overlay) { overlay.style.opacity = '0'; }
  periodMs = 850;
  flashOn = false;
}

export function isBeaconRunning() {
  return running;
}
