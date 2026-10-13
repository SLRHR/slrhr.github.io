import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { WALK_DURATION, GREETING_DURATION, ENTRY_DURATION, WALK_DISTANCE, smoothStep, motionEnvelope, sampleGait, sampleIdle, sampleArmGesture } from './mascot-motion.js';

// A small articulated figure: a rounded mask, soft horns and a draped, split cloak.
export function createKnightGuide(stage, canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 || navigator.connection?.saveData;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 2.6, -2.6, .1, 30);
  camera.position.set(0, 2.1, 9);
  camera.lookAt(0, 1.25, 0);

  const shell = new THREE.MeshStandardMaterial({ color: 0xf4f2e9, roughness: .58 });
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: .78 });
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: .72 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: 0x363d50, roughness: .98, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x757781, roughness: .85, metalness: .12 });

  scene.add(new THREE.HemisphereLight(0xeaf1ff, 0x30303b, 2));
  const key = new THREE.DirectionalLight(0xfff9ee, 2.7);
  key.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight(0xb5c8ed, 2);
  rim.position.set(3, 3, -3);
  const fill = new THREE.DirectionalLight(0xc4cddc, .6);
  fill.position.set(4, 1, 4);
  scene.add(key, rim, fill);

  const actor = new THREE.Group();
  actor.scale.setScalar(.918);
  const raycaster = new THREE.Raycaster();
  const hitPointer = new THREE.Vector2();
  const torso = new THREE.Group();
  const head = new THREE.Group();
  const headHeight = 1.299;
  head.position.y = headHeight;
  head.scale.set(.675, .7128, .7128);
  torso.add(head);
  actor.add(torso);
  scene.add(actor);

  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function surface(columns, rows, point) {
    const positions = [], indices = [];
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) positions.push(...point(col / columns, row / rows));
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  // A softly rounded vertical oval; eye inlays follow the same mask profile.
  const maskWidth = .625, maskHeight = .61, maskDepth = .455;
  const maskRoundness = .94, maskLatitude = .94;
  const skull = new THREE.SphereGeometry(1, lowPower ? 40 : 56, lowPower ? 28 : 40);
  const vertices = skull.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const latitude = Math.sqrt(Math.max(0, 1 - y * y));
    const width = maskWidth * Math.pow(latitude, maskLatitude) * (1 + .015 * y);
    const depth = maskDepth * Math.pow(latitude, .82);
    vertices.setXYZ(i, latitude > .00001 ? x / latitude * width : 0,
      maskHeight * Math.sign(y) * Math.pow(Math.abs(y), maskRoundness),
      latitude > .00001 ? z / latitude * depth : 0);
  }
  skull.computeVertexNormals();
  mesh(skull, shell, head);

  const frontDepth = (x, y) => {
    const latitudeY = Math.pow(Math.min(.9999, Math.abs(y) / maskHeight), 1 / maskRoundness);
    const radius = Math.sqrt(1 - latitudeY * latitudeY);
    const width = maskWidth * Math.pow(radius, maskLatitude) * (1 + .015 * Math.sign(y) * latitudeY);
    return maskDepth * Math.pow(radius, .82) * Math.sqrt(Math.max(.005, 1 - x * x / (width * width)));
  };
  [-1, 1].forEach(side => {
    // Black apertures follow the mask surface instead of protruding like eyeballs.
    const eye = surface(40, 7, (u, v) => {
      const angle = u * Math.PI * 2, tilt = side * -.055;
      const ex = Math.cos(angle) * .170 * v, ey = Math.sin(angle) * .222 * v;
      const x = side * .287 + ex * Math.cos(tilt) - ey * Math.sin(tilt);
      const y = -.080 + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      return [x, y, frontDepth(x, y) + .005];
    });
    // The radial patch uses the opposite winding from rectangular cloth panels.
    eye.scale(-1, 1, 1);
    mesh(eye, new THREE.MeshBasicMaterial({ color: 0x030407, side: THREE.DoubleSide }), head);

    const hornPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .490, .320, -.065),
      new THREE.Vector3(side * .654, .518, -.065),
      new THREE.Vector3(side * .698, .730, -.055),
      new THREE.Vector3(side * .653, .910, -.040),
      new THREE.Vector3(side * .529, 1.008, -.022)
    ]);
    const horn = surface(lowPower ? 18 : 24, 36, (u, v) => {
      const center = hornPath.getPoint(v), tangent = hornPath.getTangent(v);
      const normal = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
      const angle = u * Math.PI * 2;
      // Keep the horns plump almost to the end, then close them with a round cap.
      const cap = v < .82 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - .82) / .18) ** 2));
      const radius = (.153 - .083 * Math.pow(v, .85)) * cap;
      return [center.x + normal.x * Math.cos(angle) * radius,
        center.y + normal.y * Math.cos(angle) * radius,
        center.z + Math.sin(angle) * radius * .91];
    });
    mesh(horn, shell, head);
  });

  const coreGeometry = new THREE.SphereGeometry(1, 24, 20);
  const coreVertices = coreGeometry.attributes.position;
  for (let i = 0; i < coreVertices.count; i++) {
    const y = coreVertices.getY(i), pear = 1 - .17 * y;
    coreVertices.setXYZ(i, coreVertices.getX(i) * .25 * pear, y * .34, coreVertices.getZ(i) * .20 * pear);
  }
  coreGeometry.computeVertexNormals();
  mesh(coreGeometry, bodyMaterial, torso, 0, .59, 0);
  const cloakRig = new THREE.Group();
  torso.add(cloakRig);
  const clothMeshes = [];
  function addCloth(geometry, material) {
    const object = mesh(geometry, material, cloakRig);
    const rest = geometry.attributes.position.array.slice();
    const weights = new Float32Array(geometry.attributes.position.count * 2);
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const n = i * 3, angle = Math.atan2(rest[n], rest[n + 2] / .76);
      const rightFlap = rest[n] > 0 ? smoothStep((Math.PI - angle) / .8) : 0;
      weights[i * 2] = Math.pow(Math.max(0, (1.04 - rest[n + 1]) / .75), 1.5);
      weights[i * 2 + 1] = rightFlap * smoothStep((1.045 - rest[n + 1]) / .22);
    }
    clothMeshes.push({ object, rest, weights });
    return object;
  }

  // The reference's resting cloak: two downward points, an open front and long
  // folds from the neck. It is one draped surface, not a stack of separate ribbons.
  addCloth(surface(lowPower ? 56 : 80, 28, (u, v) => {
    const opening = .035 + 1.54 * Math.pow(v, 1.5);
    const angle = opening / 2 + u * (Math.PI * 2 - opening) + .055 * Math.sin(v * Math.PI);
    const edgeDistance = Math.min(u, 1 - u) * Math.PI * 2;
    const hem = .405 - .14 * Math.exp(-.5 * (edgeDistance / .36) ** 2) + .017 * Math.cos(angle * 5 + .25);
    const y = 1.045 * (1 - v) + hem * v;
    const fold = .036 * Math.cos(angle * 8 + v * 1.35) * Math.pow(Math.sin(v * Math.PI * .83), .8);
    const spread = .208 + .218 * Math.sin(v * Math.PI * .53) + fold;
    return [Math.sin(angle) * spread, y, Math.cos(angle) * spread * .76];
  }), clothMaterial);

  // A small nail on the back, with just its hilt above the left shoulder.
  const nail = new THREE.Group();
  nail.position.set(0, .66, -.22);
  nail.rotation.z = .72;
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-.055, .3); bladeShape.lineTo(.055, .3);
  bladeShape.lineTo(.035, -.52); bladeShape.lineTo(0, -.66); bladeShape.lineTo(-.035, -.52); bladeShape.closePath();
  mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: .023, bevelEnabled: false }), steel, nail);
  mesh(new THREE.CapsuleGeometry(.044, .19, 4, 8), steel, nail, 0, .45, 0);
  const guard = mesh(new THREE.SphereGeometry(1, 12, 8), steel, nail, 0, .33, 0);
  guard.scale.set(.115, .035, .04);
  torso.add(nail);

  const limbs = {};
  [-1, 1].forEach(side => {
    const arm = new THREE.Group();
    arm.position.set(side * .245, .88, -.015);
    mesh(new THREE.CapsuleGeometry(.058, .145, 5, 12), armMaterial, arm, 0, -.10, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -.195;
    mesh(new THREE.CapsuleGeometry(.053, .115, 5, 12), armMaterial, elbow, 0, -.080, 0);
    const hand = mesh(new THREE.SphereGeometry(1, 16, 12), armMaterial, elbow, 0, -.185, .014);
    hand.scale.set(.075, .083, .060);
    arm.add(elbow); torso.add(arm);
    const leg = new THREE.Group();
    leg.position.set(side * .13, .34, 0);
    mesh(new THREE.CapsuleGeometry(.069, .08, 4, 12), bodyMaterial, leg, 0, -.08, 0);
    const knee = new THREE.Group();
    knee.position.y = -.16;
    mesh(new THREE.CapsuleGeometry(.063, .075, 4, 12), bodyMaterial, knee, 0, -.07, .002);
    const foot = mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial, knee, 0, -.115, .035);
    foot.scale.set(.076, .060, .105);
    leg.add(knee); actor.add(leg);
    limbs[side === -1 ? 'left' : 'right'] = { arm, elbow, hand, leg, knee, foot };
  });

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 96;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 5, 48, 48, 47);
  gradient.addColorStop(0, 'rgba(0,0,0,.8)'); gradient.addColorStop(.4, 'rgba(0,0,0,.35)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 96, 96);
  const shadow = mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }), scene, 0, .005, 0);
  shadow.rotation.x = -Math.PI / 2;

  const floor = mesh(new THREE.CircleGeometry(1.35, 64), new THREE.MeshBasicMaterial({ color: 0x5a646c, transparent: true, opacity: .052, side: THREE.DoubleSide, depthWrite: false }), scene, 0, -.018, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.y = .7;

  let viewWidth = 1, viewHeight = 1, compact = false;
  let elapsed = 0, entryTime = reduced ? ENTRY_DURATION : 0, actionStart = -100, actionDuration = 0, actionType = 'idle';
  let idleAfter = ENTRY_DURATION;
  let cloakOpen = 0, previousCloakOpen = 0;
  let chatOpen = false, visible = false, frame = 0, lastTime = 0, lastRender = 0, lastPhase = '';
  let pointerX = 0, pointerY = 0, slowFrames = 0;
  const damp = (value, target, rate, dt) => THREE.MathUtils.damp(value, target, rate, dt);

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    viewWidth = rect.width; viewHeight = rect.height; compact = viewWidth < 520;
    const worldHeight = compact ? 5.25 : 5.35;
    camera.left = -worldHeight * rect.width / rect.height / 2;
    camera.right = -camera.left; camera.top = worldHeight / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
    schedule();
  }

  function trigger(type, duration) {
    if (reduced) return;
    actionType = type; actionStart = elapsed; actionDuration = duration;
    idleAfter = elapsed + duration;
    schedule();
  }
  const controller = {
    greet: () => trigger('greeting', GREETING_DURATION),
    listen: () => trigger('listening', 1.25),
    answer: duration => trigger('answering', duration),
    setOpen: open => { chatOpen = open; schedule(); },
    hitTest: (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !stage.classList.contains('webgl-ready')) return false;
      hitPointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      raycaster.setFromCamera(hitPointer, camera);
      return raycaster.intersectObject(actor, true).length > 0;
    },
    replay: () => {
      entryTime = reduced ? ENTRY_DURATION : 0;
      actionStart = -100;
      idleAfter = elapsed + ENTRY_DURATION;
      lastPhase = '';
      schedule();
    }
  };

  function render(now) {
    frame = 0;
    if (!visible || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / 60;
    lastTime = now; elapsed += dt; entryTime += dt;
    const active = entryTime < ENTRY_DURATION || elapsed - actionStart < actionDuration;
    const fps = lowPower ? (active ? 30 : 20) : (active ? 60 : 30);
    if (!reduced && now - lastRender < 1000 / fps - .8) { schedule(); return; }
    const poseDt = Math.min((now - lastRender) / 1000 || dt, .06);
    lastRender = now;
    const t = reduced ? 0 : elapsed;
    const walkP = Math.min(1, entryTime / WALK_DURATION);
    const gait = sampleGait(walkP);
    const walk = reduced ? 0 : gait.weight;
    const step = gait.stride * Math.PI * 2;
    const bodyY = reduced ? 0 : gait.bodyY;
    let greeting = 0, talk = 0, listening = 0, actionT = 0;
    let phase = walkP < 1 ? 'walking' : 'idle';
    if (!reduced && entryTime >= WALK_DURATION && entryTime < ENTRY_DURATION) {
      actionT = entryTime - WALK_DURATION;
      greeting = motionEnvelope(actionT, GREETING_DURATION); phase = 'greeting';
    } else if (!reduced && elapsed - actionStart < actionDuration) {
      actionT = elapsed - actionStart;
      const weight = motionEnvelope(actionT, actionDuration);
      greeting = actionType === 'greeting' ? weight : 0;
      talk = actionType === 'answering' ? weight : 0;
      listening = actionType === 'listening' ? weight : 0;
      phase = actionType;
    }
    const idle = sampleIdle(!reduced && phase === 'idle' ? elapsed - idleAfter : 0);
    if (phase === 'idle') phase = idle.phase;
    const bow = greeting * Math.exp(-(((actionT - .56) / .40) ** 2));
    const wave = greeting * smoothStep((actionT - .38) / .62);
    const armGesture = sampleArmGesture(actionT, phase === 'greeting' ? GREETING_DURATION : actionDuration, reduced ? 'idle' : phase);
    const phrase = Math.sin(actionT * 1.55) ** 2;
    const phaseChanged = phase !== lastPhase;
    if (phaseChanged) { stage.dataset.motion = phase; lastPhase = phase; }
    const gesturePhase = armGesture.raise > .8 ? 'waving' : armGesture.emerge > .5 ? 'hand-out' : armGesture.cloak > .5 ? 'cloak-open' : 'rest';
    if (stage.dataset.gesture !== gesturePhase) stage.dataset.gesture = gesturePhase;

    const framingScale = .9 * (chatOpen ? (compact ? .60 : .86) : 1.02);
    const targetX = chatOpen && !compact ? camera.left * .51 : 0;
    const targetY = chatOpen && compact ? 1.82 : 0;
    actor.scale.setScalar(reduced ? framingScale : damp(actor.scale.x, framingScale, 5, poseDt));
    actor.position.x = reduced ? targetX : damp(actor.position.x, targetX, 6, poseDt);
    // Root travel and foot contacts share the same distance-driven clock.
    const approach = 1 - gait.travel;
    const entryOffset = -WALK_DISTANCE * approach;
    const targetRootX = targetX + entryOffset;
    actor.position.x = walkP < 1 ? targetRootX : actor.position.x;
    actor.position.y = reduced ? targetY : damp(actor.position.y, targetY + bodyY, 12, poseDt);
    actor.position.z = -.26 * approach;
    actor.rotation.y = damp(actor.rotation.y, .17 + 1.27 * walk - .06 * talk, 7, poseDt);
    torso.rotation.z = gait.sway + Math.sin(t * 1.25) * .006 + idle.bodyRoll;
    torso.rotation.x = .035 * walk + .045 * bow;

    const headX = pointerY * .032 + bow * .13 + talk * (.018 + .042 * phrase) + idle.pitch;
    head.rotation.x = damp(head.rotation.x, headX, 5.5, poseDt);
    head.rotation.y = damp(head.rotation.y, pointerX * .10 - listening * .09 - walk * .10 + talk * Math.sin(actionT * 1.3) * .045 + idle.yaw, 4.5, poseDt);
    head.rotation.z = damp(head.rotation.z, -.028 * wave + .085 * listening + talk * Math.sin(actionT * 1.1) * .024 + idle.tilt - gait.sway * .35, 5, poseDt);
    head.position.y = headHeight + Math.sin(t * 1.55) * .006;

    Object.entries(limbs).forEach(([name, limb]) => {
      const side = name === 'left' ? -1 : 1;
      const footPose = sampleGait(walkP, side);
      const { lift, footZ } = footPose;
      const down = .297 + bodyY - lift;
      const kneeAngle = Math.acos(THREE.MathUtils.clamp((down * down + footZ * footZ - .16 ** 2 - .14 ** 2) / (2 * .16 * .14), -1, 1));
      const hipAngle = Math.atan2(-footZ, down) - Math.atan2(.14 * Math.sin(kneeAngle), .16 + .14 * Math.cos(kneeAngle));
      limb.leg.rotation.x = hipAngle; limb.knee.rotation.x = kneeAngle;
      limb.foot.rotation.x = -hipAngle - kneeAngle + footPose.footPitch;
      // The shoulder stays attached. The hand clears the open cloak before rising.
      let armX = footPose.armSwing;
      let armZ = side * (.08 + Math.sin(t * 1.55 + side) * .010);
      let elbowZ = side * .09, elbowX = -.07;
      if (side === 1) {
        armZ += -.12 * armGesture.emerge + 2.06 * armGesture.raise;
        armX += -.42 * armGesture.emerge - .18 * armGesture.raise;
        elbowZ += armGesture.raise * (.40 + .15 * armGesture.wave);
        elbowX -= .28 * armGesture.emerge + .06 * armGesture.raise;
      }
      limb.arm.rotation.x = damp(limb.arm.rotation.x, armX, 9, poseDt);
      limb.arm.rotation.z = damp(limb.arm.rotation.z, armZ, 9, poseDt);
      limb.elbow.rotation.z = damp(limb.elbow.rotation.z, elbowZ, 10, poseDt);
      limb.elbow.rotation.x = damp(limb.elbow.rotation.x, elbowX, 8, poseDt);
      limb.hand.rotation.z = side === 1 ? armGesture.raise * armGesture.wave * .09 : 0;
    });

    // Keep the cloth out of the way until an interrupted gesture has retracted.
    const rightArm = limbs.right;
    const handOutside = Math.abs(rightArm.arm.rotation.z - .08) > .10 || rightArm.arm.rotation.x < -.075 || rightArm.elbow.rotation.x < -.12;
    const cloakTarget = Math.max(armGesture.cloak, cloakOpen > .1 && handOutside ? 1 : 0);
    cloakOpen = reduced ? 0 : damp(cloakOpen, cloakTarget, cloakTarget > cloakOpen ? 14 : 7, poseDt);
    const updateClothNormals = Math.abs(cloakOpen - previousCloakOpen) > .002;
    const sway = Math.sin(t * 1.5) * .007 + Math.sin(step - .55) * .021 * walk + idle.bodyRoll * .2;
    clothMeshes.forEach(({ object, rest, weights }) => {
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const n = i * 3;
        const weight = weights[i * 2];
        const opening = cloakOpen * weights[i * 2 + 1];
        const turn = opening * 1.12;
        const x = rest[n] * Math.cos(turn) + rest[n + 2] / .76 * Math.sin(turn);
        const z = (rest[n + 2] / .76 * Math.cos(turn) - rest[n] * Math.sin(turn)) * .76;
        positions.setXYZ(i, x + sway * weight,
          rest[n + 1] + opening * .06 + Math.sin(t * 1.7 + rest[n] * 3) * .007 * weight,
          z + (Math.sin(t * 1.8 + rest[n] * 4) * .015 - .035 * walk) * weight);
      }
      positions.needsUpdate = true;
      if (updateClothNormals) object.geometry.computeVertexNormals();
    });
    if (updateClothNormals) previousCloakOpen = cloakOpen;
    shadow.position.x = actor.position.x;
    shadow.position.y = actor.position.y - bodyY + .005;
    shadow.scale.setScalar(actor.scale.x);
    floor.position.x = actor.position.x;
    floor.position.y = actor.position.y - bodyY - .018;
    floor.scale.set(actor.scale.x, actor.scale.x * .7, actor.scale.x);
    const renderStart = performance.now();
    renderer.render(scene, camera);
    if (performance.now() - renderStart > 24) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 20 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .2)); resize(); slowFrames = 0;
    }
    if (phaseChanged || !stage.classList.contains('webgl-ready')) {
      stage.classList.add('webgl-ready');
      stage.dataset.modelVersion = 'knight-interaction-v5';
      stage.dataset.triangles = String(renderer.info.render.triangles);
      stage.dataset.drawCalls = String(renderer.info.render.calls);
    }
    if (!reduced) schedule();
  }

  function schedule() { if (visible && !document.hidden && !frame) frame = requestAnimationFrame(render); }
  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / viewWidth * 2 - 1;
    pointerY = (event.clientY - rect.top) / viewHeight * 2 - 1;
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    else schedule();
  }, { threshold: .05 }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; schedule();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); visible = false; cancelAnimationFrame(frame); frame = 0;
    stage.classList.remove('webgl-ready');
  });
  canvas.addEventListener('webglcontextrestored', () => { visible = true; schedule(); });
  resize();
  return controller;
}
