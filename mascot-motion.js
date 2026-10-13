// Pure pose sampling keeps the gait independent of frame rate and render quality.
export const WALK_DURATION = 3.25;
export const GREETING_DURATION = 3.8;
export const ENTRY_DURATION = WALK_DURATION + GREETING_DURATION;
export const WALK_DISTANCE = 2.4;
const CYCLES = 6;
const STANCE = .6;
const REACH = WALK_DISTANCE / CYCLES * STANCE / 2;
const TAU = Math.PI * 2;

export function smoothStep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function motionEnvelope(time, duration) {
  return smoothStep(time / .5) * (1 - smoothStep((time - duration + .7) / .7));
}

const rise = (time, start, end) => smoothStep((time - start) / (end - start));
const hold = (time, start, inEnd, outStart, end) => rise(time, start, inEnd) * (1 - rise(time, outStart, end));

export function sampleArmGesture(time, duration, type) {
  if (type === 'greeting') {
    return {
      // Open the cloth first, clear the hand, raise it, then reverse that order.
      cloak: hold(time, .20, .65, duration - .40, duration),
      emerge: hold(time, .70, 1.05, duration - 1.05, duration - .70),
      raise: hold(time, 1.10, 1.50, duration - 1.55, duration - 1.12),
      wave: Math.sin((time - 1.5) * 8.4)
    };
  }
  if (type === 'answering') {
    return {
      cloak: hold(time, 0, .30, duration - .30, duration),
      emerge: hold(time, .35, .70, duration - .95, duration - .60),
      raise: hold(time, .80, 1.10, duration - 1.15, duration - .95) * (.13 + .055 * Math.sin(time * 1.55) ** 2),
      wave: 0
    };
  }
  return { cloak: 0, emerge: 0, raise: 0, wave: 0 };
}

export function sampleGait(progress, side = 1) {
  const p = Math.max(0, Math.min(1, progress));
  const travel = smoothStep(p);
  const weight = smoothStep(p / .10) * (1 - smoothStep((p - .90) / .10));
  const stride = travel * CYCLES;
  const cycle = (stride + (side < 0 ? .5 : 0)) % 1;
  const contact = cycle < STANCE;
  const phase = contact ? cycle / STANCE : (cycle - STANCE) / (1 - STANCE);
  // The planted foot moves back at the same speed as the root moves forward.
  // The lifted foot returns from behind the body to the next forward landing.
  const footZ = contact ? REACH * (1 - 2 * phase) : REACH * (2 * smoothStep(phase) - 1);
  const lift = contact ? 0 : .076 * Math.pow(Math.sin(Math.PI * phase), 1.35);
  const footPitch = contact
    ? -.10 * (1 - smoothStep(phase / .16)) + .13 * smoothStep((phase - .78) / .22)
    : .13 * (1 - smoothStep(phase / .3)) - .10 * smoothStep((phase - .5) / .5) - .06 * Math.sin(Math.PI * phase);
  const bodyWave = Math.sin(stride * TAU);
  return {
    travel, weight, stride, cycle, contact,
    footZ: footZ * weight,
    lift: lift * weight,
    footPitch: footPitch * weight,
    armSwing: footZ / REACH * .32 * weight,
    bodyY: (-.033 + .013 * bodyWave * bodyWave) * weight,
    sway: bodyWave * .020 * weight
  };
}

export function sampleIdle(time) {
  const t = Math.max(0, time) % 18;
  const look = motionEnvelope(t - 5, 4.2);
  const curious = motionEnvelope(t - 12, 2.8);
  return {
    phase: look > .01 ? 'looking-around' : curious > .01 ? 'curious' : 'idle',
    yaw: look * Math.sin((t - 5) * Math.PI / 2.1) * .20,
    tilt: -curious * .095,
    pitch: curious * .028,
    bodyRoll: curious * .012
  };
}
