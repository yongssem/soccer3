import * as THREE from './vendor/three.module.min.js';

// 같은 월드와 공 궤적을 두 카메라가 관찰한다. 화면별 가짜 공은 사용하지 않는다.
export function createArena(views, kicker = 'p1', preview = false) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#abcbd4');
  scene.fog = new THREE.Fog('#abcbd4', 46, 115);
  const resources = new Set();
  const material = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    resources.add(m); return m;
  };
  const white = material('#f4f8ed'), dark = material('#14283a');
  const blue = material('#2583ef'), red = material('#f15d57');
  const gold = material('#ffd354');
  const grass = [material('#4a9c68'), material('#438e5e')];
  const mesh = (geometry, mat, x, y, z, parent = scene) => {
    resources.add(geometry);
    const o = new THREE.Mesh(geometry, mat); o.position.set(x, y, z);
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const sphere = (r, mat, x, y, z, parent) => mesh(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z, parent);
  const line = (points, color = '#e6f3de', opacity = 1, parent = scene) => {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    resources.add(geo); resources.add(mat);
    const o = new THREE.Line(geo, mat); parent.add(o); return o;
  };
  scene.add(new THREE.HemisphereLight('#f2f9ff', '#456747', 2.3));
  const sun = new THREE.DirectionalLight('#fff1d6', 3.1);
  sun.position.set(-12, 23, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 20, bottom: -15, near: 1, far: 70 });
  sun.shadow.bias = -0.001; scene.add(sun);

  // 잔디 줄무늬와 실제 필드 라인 (미터 단위).
  for (let z = -24; z < 62; z += 4) box(68, 0.12, 4, grass[(z / 4 + 6) % 2], 0, -0.08, z);
  line([[-20, .015, 0], [-20, .015, 38], [20, .015, 38], [20, .015, 0], [-20, .015, 0]]);
  line([[-10, .02, 0], [-10, .02, 16.5], [10, .02, 16.5], [10, .02, 0]]);
  line([[-5.5, .02, 0], [-5.5, .02, 5.5], [5.5, .02, 5.5], [5.5, .02, 0]]);
  const spot = mesh(new THREE.CircleGeometry(.13, 24), white, 0, .025, 11); spot.rotation.x = -Math.PI / 2;
  const arc = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI; arc.push([Math.cos(a) * 5, .025, 16.5 + Math.sin(a) * 2]); }
  line(arc);

  // 3D 골대: 앞 프레임, 뒤 지지대, 옆/위/뒤 그물.
  const goal = new THREE.Group(); scene.add(goal);
  const pole = (a, b, radius = .065) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    const p = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), white, 0, 0, 0, goal);
    p.position.copy(from.add(to).multiplyScalar(.5)); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  };
  pole([-3.66, 0, 0], [-3.66, 2.44, 0]); pole([3.66, 0, 0], [3.66, 2.44, 0]);
  pole([-3.66, 2.44, 0], [3.66, 2.44, 0]);
  pole([-3.66, 0, -2], [-3.66, 2.44, 0], .035); pole([3.66, 0, -2], [3.66, 2.44, 0], .035);
  const net = new THREE.Group(); goal.add(net);
  for (let x = -3.66; x <= 3.67; x += .24) {
    line([[x, 0, -2], [x, 2.44, -1], [x, 2.44, 0]], '#e3efed', .43, net);
  }
  for (let y = 0; y <= 2.45; y += .20) {
    const z = -2 + y / 2.44;
    line([[-3.66, y, 0], [-3.66, y, z], [3.66, y, z], [3.66, y, 0]], '#e3efed', .43, net);
  }

  // 관중은 InstancedMesh로 그려 드로 콜을 줄인다.
  const standMat = material('#253c51'), seatMat = material('#36546a');
  const fanGeo = new THREE.BoxGeometry(.28, .48, .28); resources.add(fanGeo);
  const fans = new THREE.InstancedMesh(fanGeo, white, 1100);
  const transform = new THREE.Object3D(); const palette = ['#ee7261', '#f4c952', '#a9d7d4', '#faf0d7', '#4f9bc8'];
  let count = 0;
  for (let row = 0; row < 10; row++) {
    const y = .65 + row * .65, z = -9 - row * 1.1;
    box(57, .6, 1.2, row % 2 ? standMat : seatMat, 0, y - .7, z);
    for (let col = 0; col < 110; col++) {
      const x = (col - 54.5) * .49;
      transform.position.set(x, y + .1, z); transform.updateMatrix();
      fans.setMatrixAt(count, transform.matrix); fans.setColorAt(count++, new THREE.Color(palette[(col * 7 + row * 3) % palette.length]));
    }
  }
  scene.add(fans);
  for (const signX of [-17, -8.5, 0, 8.5, 17]) {
    box(8.2, .85, .16, signX % 2 === 0 ? blue : dark, signX, .5, -5.8);
    box(7.6, .035, .18, gold, signX, .94, -5.8);
  }
  for (const x of [-25, 25]) {
    box(.24, 15, .24, dark, x, 7.5, -5);
    box(5, 1.1, .35, dark, x, 15, -5);
    for (let i = -2; i <= 2; i++) box(.64, .6, .08, material('#fff5d2', { emissive: '#fff0bf', emissiveIntensity: .7 }), x + i * .88, 15, -4.78);
  }

  function player(shirt, goalie = false) {
    const root = new THREE.Group(); scene.add(root);
    root.name = goalie ? 'goalkeeper' : 'shooter';
    const body = new THREE.Group(); root.add(body);
    const skin = material(goalie ? '#c68c67' : '#e2b38c');
    const hairMat = material(goalie ? '#30251e' : '#231d1c');
    const shorts = material(goalie ? '#223443' : '#f0f2ed');
    const bootMat = material(goalie ? '#ffd247' : '#ed6b42', { roughness:.45 });
    const ellipsoid = (r, scale, mat, x, y, z, parent = body) => {
      const part = sphere(r, mat, x, y, z, parent); part.scale.set(...scale); return part;
    };
    const segment = (length, radiusTop, radiusBottom, mat, parent, y) =>
      mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12), mat, 0, y, 0, parent);

    // 성인 선수 비율: 약 1.85m, 작은 머리·넓은 어깨·긴 다리.
    const torso = mesh(new THREE.CylinderGeometry(.235, .165, .53, 16), shirt, 0, 1.225, 0, body);
    torso.scale.z = .61;
    ellipsoid(.19, [1.08,.74,.67], shorts, 0, .935, 0);
    segment(.13, .062, .07, skin, body, 1.535);
    const head = new THREE.Group(); head.position.set(0, 1.705, 0); body.add(head);
    ellipsoid(.137, [.85,1.1,.88], skin, 0, 0, 0, head);
    ellipsoid(.13, [.88,.66,.94], hairMat, 0, .094, -.018, head);
    ellipsoid(.12, [.85,.7,.48], hairMat, 0, .045, -.078, head);
    ellipsoid(.047, [.85,.5,.6], hairMat, -.067, .11, .075, head);
    for (const side of [-1, 1]) {
      ellipsoid(.026, [.56,1,.62], skin, side * .115, -.005, -.004, head);
      ellipsoid(.022, [1,.42,.42], white, side * .046, .018, .113, head);
      ellipsoid(.011, [.65,.8,.6], dark, side * .046, .018, .122, head);
      const brow = box(.046, .009, .012, hairMat, side * .046, .047, .115, head); brow.rotation.z = side * -.1;
    }
    ellipsoid(.027, [.55,1,.75], skin, 0, -.008, .123, head);
    box(.043, .007, .009, material('#905e4e'), 0, -.062, .107, head);

    // 유니폼 목선, 어깨 줄무늬, 앞 엠블럼과 뒷 등번호.
    const collar = mesh(new THREE.TorusGeometry(.072, .012, 6, 20), white, 0, 1.493, .003, body);
    collar.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      box(.04, .035, .23, white, side * .172, 1.49, 0, body);
      box(.014, .40, .009, white, side * .145, 1.205, .119, body);
    }
    const crest = mesh(new THREE.CircleGeometry(.032, 5), gold, -.11, 1.37, .143, body);
    crest.rotation.z = Math.PI;
    const label = document.createElement('canvas'); label.width = 128; label.height = 160;
    const ctx = label.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 18px Arial'; ctx.fillText('MUMU', 64, 24);
    ctx.font = 'bold 102px Arial'; ctx.fillText(goalie ? '1' : '9', 64, 126);
    const texture = new THREE.CanvasTexture(label); texture.colorSpace = THREE.SRGBColorSpace; resources.add(texture);
    const numberMat = new THREE.MeshBasicMaterial({map:texture, transparent:true, depthWrite:false}); resources.add(numberMat);
    const number = mesh(new THREE.PlaneGeometry(.25, .32), numberMat, 0, 1.23, -.146, body); number.rotation.y = Math.PI;

    const limbs = [], knees = [], arms = [], elbows = [], insteps = [], feet = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .12, .93, 0); body.add(leg);
      leg.name = side < 0 ? 'left-hip' : 'right-hip';
      segment(.21, .115, .10, shorts, leg, -.06);
      segment(.28, .086, .065, skin, leg, -.235);
      const knee = new THREE.Group(); knee.position.y = -.39; leg.add(knee);
      knee.name = side < 0 ? 'left-knee' : 'right-knee';
      sphere(.064, skin, 0, 0, 0, knee);
      segment(.16, .062, .071, skin, knee, -.07);
      segment(.27, .072, .045, goalie ? shirt : white, knee, -.255);
      segment(.025, .073, .073, white, knee, -.137);
      const foot = new THREE.Group(); foot.position.y = -.44; knee.add(foot); feet.push(foot);
      const boot = ellipsoid(.10, [.72,.65,1.62], bootMat, 0, -.018, .07, foot);
      boot.name = side < 0 ? 'left-boot' : 'right-boot';
      const instep = new THREE.Object3D(); instep.position.set(0, -.018, .215); foot.add(instep);
      instep.name = side < 0 ? 'left-instep' : 'right-instep'; insteps.push(instep);
      box(.14, .025, .27, dark, 0, -.068, .075, foot);
      for (let n = 0; n < 3; n++) box(.09, .01, .012, white, 0, .026, .075 + n * .027, foot);
      limbs.push(leg); knees.push(knee);

      const arm = new THREE.Group(); arm.position.set(side * .225, 1.405, 0); body.add(arm);
      arm.rotation.z = side * (goalie ? .55 : .12);
      ellipsoid(.105, [.92,1,.9], shirt, 0, -.035, 0, arm);
      segment(goalie ? .27 : .14, .085, .066, shirt, arm, goalie ? -.16 : -.095);
      if (!goalie) segment(.18, .064, .052, skin, arm, -.24);
      const elbow = new THREE.Group(); elbow.position.y = -.32; arm.add(elbow);
      elbow.rotation.x = goalie ? -.8 : -.22;
      sphere(.055, goalie ? shirt : skin, 0, 0, 0, elbow);
      segment(.24, .055, .041, goalie ? shirt : skin, elbow, -.12);
      if (goalie) {
        segment(.055, .056, .056, gold, elbow, -.25);
        const palm = ellipsoid(.075, [.82,1.16,.45], white, 0, -.315, .01, elbow);
        palm.name = side < 0 ? 'left-glove' : 'right-glove';
        for (let finger=0; finger<4; finger++) {
          const digit = mesh(new THREE.CapsuleGeometry(.013, .047, 3, 6), white, -.04+finger*.027, -.387, .01, elbow);
          digit.rotation.z = (finger-1.5)*.12;
        }
        ellipsoid(.026, [.65,1.4,.8], gold, side*.068, -.315, .017, elbow);
      } else ellipsoid(.054, [.75,1.3,.55], skin, 0, -.29, .013, elbow);
      arms.push(arm); elbows.push(elbow);
    }
    if (goalie) {
      limbs[0].rotation.z = -.16; limbs[1].rotation.z = .16;
      limbs.forEach(leg => leg.rotation.x = -.13); knees.forEach(knee => knee.rotation.x = .26);
      body.position.y = -.025;
    }
    return { root, body, limbs, knees, arms, elbows, head, insteps, feet };
  }
  const shooter = player(kicker === 'p1' ? blue : red);
  shooter.root.position.set(.9, 0, 13.1); shooter.root.rotation.y = Math.PI;
  const keeper = player(kicker === 'p1' ? red : blue, true); keeper.root.position.set(0, 0, .45);

  const ball = new THREE.Group(); scene.add(ball); ball.position.set(0, .17, 11);
  ball.name = 'match-ball';
  const ballBase = mesh(new THREE.IcosahedronGeometry(.17, 2), white, 0, 0, 0, ball);
  const patchMat = material('#152533');
  const directions = [[0,1,0],[0,-1,0],[1,.2,.3],[-1,.2,.3],[.3,.1,-1],[-.3,.1,1]];
  for (const direction of directions) {
    const normal = new THREE.Vector3(...direction).normalize();
    const patch = mesh(new THREE.CircleGeometry(.062, 5), patchMat, 0, 0, 0, ball);
    patch.position.copy(normal.clone().multiplyScalar(.171)); patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }
  const shadow = mesh(new THREE.CircleGeometry(.23, 24), new THREE.MeshBasicMaterial({color:'#183e30', transparent:true, opacity:.3, depthWrite:false}), 0, .012, 11);
  resources.add(shadow.material); shadow.rotation.x = -Math.PI / 2;

  let disposed = false, frameId, motion = null, observer = null;
  const renderers = [];
  try {
    for (const view of views) {
      const renderer = new THREE.WebGLRenderer({ canvas: view.canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      const camera = new THREE.PerspectiveCamera(preview ? 47 : 52, 1, .1, 150);
      if (preview) { camera.position.set(11, 7, 21); camera.lookAt(0, 1, 3); }
      else if (view.role === 'keeper') { camera.position.set(0, 3.3, -6.7); camera.lookAt(0, -.3, 8); }
      else { camera.position.set(0, 3.8, 19.5); camera.lookAt(0, .6, 0); }
      camera.updateMatrixWorld();
      renderers.push({ ...view, renderer, camera });
    }
  } catch (error) { dispose(); throw error; }

  function resize() {
    for (const view of renderers) {
      const rect = view.canvas.getBoundingClientRect();
      const width = view.canvas.clientWidth || rect.width, height = view.canvas.clientHeight || rect.height;
      if (!width || !height) continue;
      view.renderer.setSize(width, height, false);
      // 좁은 화면에서도 골대 전체를 담는다.
      view.camera.aspect = width / height;
      const halfFov = view.role === 'keeper' ? 26 : 20;
      view.camera.fov = preview ? 47 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfFov * Math.PI / 180) / Math.min(1, view.camera.aspect / 1.28)));
      view.camera.updateProjectionMatrix();
      if (view.frame) {
        const project = (x, y) => new THREE.Vector3(x, y, 0).project(view.camera);
        const corners = [project(-3.66, 0), project(3.66, 0), project(-3.66, 2.44), project(3.66, 2.44)];
        const xs = corners.map(v => (v.x + 1) * width / 2), ys = corners.map(v => (1 - v.y) * height / 2);
        Object.assign(view.frame.style, { left: `${Math.min(...xs)}px`, top: `${Math.min(...ys)}px`, width: `${Math.max(...xs)-Math.min(...xs)}px`, height: `${Math.max(...ys)-Math.min(...ys)}px`, right: 'auto' });
      }
    }
  }
  observer = new ResizeObserver(resize); views.forEach(v => observer.observe(v.canvas)); resize();
  const ease = t => 1 - Math.pow(1-t, 3);
  const KICK_AT = 1200, FLIGHT_MS = 850, FINISH_AT = KICK_AT + 1290;
  const phase = (time, from, to) => THREE.MathUtils.smoothstep(time, from, to);
  const blendPoint = (a, b, t, lift = 0) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, Math.sin(t * Math.PI) * lift, 0));
  const footPoint = (x, y, z) => new THREE.Vector3(x, y, z);

  // 두 관절 역기구학으로 발을 월드 좌표에 고정한다. 몸이 움직여도 디딤발이 미끄러지지 않는다.
  function placeFoot(index, worldAnkle, pitch = 0) {
    const hip = shooter.limbs[index], knee = shooter.knees[index];
    const ankle = shooter.body.worldToLocal(worldAnkle.clone()).sub(hip.position);
    const upper = .39, lower = .44;
    const distance = THREE.MathUtils.clamp(ankle.length(), .08, upper + lower - .001);
    const direction = ankle.normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, upper * upper - along * along));
    const forward = new THREE.Vector3(0, 0, 1).addScaledVector(direction, -direction.z).normalize();
    const kneePoint = direction.clone().multiplyScalar(along).addScaledVector(forward, bend);
    const up = kneePoint.clone().normalize().negate();
    const right = forward.clone().cross(direction).normalize();
    const facing = right.clone().cross(up).normalize();
    hip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, facing));
    // 무릎은 경첩처럼 한 축으로만 접어 임의의 비틀림이 생기지 않게 한다.
    knee.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0), Math.acos(THREE.MathUtils.clamp((distance * distance - upper * upper - lower * lower) / (2 * upper * lower), -1, 1)));
    shooter.root.updateMatrixWorld(true);
    const footFacing = shooter.root.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch));
    shooter.feet[index].quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footFacing));
  }

  function animateShooter(elapsed, shot) {
    const run = phase(elapsed, 0, 920), settle = phase(elapsed, 1450, 1900);
    const stride = elapsed / 920 * Math.PI * 3;
    shooter.root.position.set(.9 - .78 * run, 0, 13.1 - 1.85 * run - .3 * settle);
    const moving = 1 - phase(elapsed, 780, 960);
    shooter.body.position.y = (-.07 + Math.sin(stride * 2) * .015 * moving) * phase(elapsed, 0, 120) + .04 * settle;
    const windup = phase(elapsed, 780, 1050), swing = phase(elapsed, 1050, KICK_AT);
    const follow = phase(elapsed, KICK_AT, 1450), recover = phase(elapsed, 1450, 1900);
    shooter.body.rotation.x = .07 * moving * phase(elapsed, 0, 160) + .12 * swing * (1 - recover);
    shooter.body.rotation.y = Math.sin(stride) * .045 * moving - .2 * windup + .36 * swing - .16 * recover;
    shooter.head.rotation.x = -shooter.body.rotation.x;
    shooter.head.rotation.y = shot.x * .12 * swing;
    shooter.arms[0].rotation.x = -.45 * Math.sin(stride) * moving + .45 * windup - .7 * swing + .25 * recover;
    shooter.arms[1].rotation.x = .45 * Math.sin(stride) * moving - .3 * windup + .55 * swing - .25 * recover;
    shooter.arms[0].rotation.z = -.12 - .5 * windup + .25 * recover;
    shooter.arms[1].rotation.z = .12 + .25 * windup - .12 * recover;
    shooter.root.updateMatrixWorld(true);

    let left = footPoint(1.02, .105, 13.1);
    if (elapsed >= 180) left = blendPoint(left, footPoint(.55, .105, 12), phase(elapsed, 180, 460), .17);
    if (elapsed >= 560) left = blendPoint(footPoint(.55, .105, 12), footPoint(.27, .105, 11.05), phase(elapsed, 560, 920), .15);
    if (elapsed >= 1550) left = blendPoint(footPoint(.27, .105, 11.05), footPoint(.27, .105, 10.95), phase(elapsed, 1550, 1900), .07);
    let right = blendPoint(footPoint(.78, .105, 13.1), footPoint(.57, .105, 12.55), phase(elapsed, 0, 240), .16);
    if (elapsed >= 400) right = blendPoint(footPoint(.57, .105, 12.55), footPoint(0, .105, 11.6), phase(elapsed, 400, 700), .18);
    if (elapsed >= 780) right = blendPoint(footPoint(0, .105, 11.6), footPoint(0, .48, 11.78), windup);
    // 발목에서 축구화 앞면까지의 길이를 반영해 1200ms에 공 표면에 접촉한다.
    if (elapsed >= 1050) right = blendPoint(footPoint(0, .48, 11.78), footPoint(0, .118, 11.37), swing);
    if (elapsed >= KICK_AT) right = blendPoint(footPoint(0, .118, 11.37), footPoint(-.05, .65, 10.86), follow);
    if (elapsed >= 1450) right = blendPoint(footPoint(-.05, .65, 10.86), footPoint(-.04, .105, 10.85), phase(elapsed, 1450, 1780));
    const footPitch = .4 * windup * (1 - swing) - .4 * follow * (1 - recover);
    placeFoot(0, left); placeFoot(1, right, footPitch);
  }
  animateShooter(0, { x:0 });
  function tick(now) {
    if (disposed) return;
    if (motion) {
      const { shot, dive, outcome, start } = motion;
      const elapsed = now - start;
      animateShooter(elapsed, shot);
      if (elapsed >= KICK_AT && !motion.struck) { motion.struck = true; motion.onStrike?.(); }
      const t = THREE.MathUtils.clamp((elapsed - KICK_AT) / FLIGHT_MS, 0, 1);
      const keeperTime = elapsed - KICK_AT + 260;
      const target = outcome === 'save' ? shot : dive;
      const dt = ease(THREE.MathUtils.clamp((keeperTime - 390) / 650, 0, 1));
      // 먼저 무릎을 굽혀 힘을 모으고, 공 도착 시점에 점프의 정점을 맞춘다.
      const crouch = Math.sin(THREE.MathUtils.clamp((keeperTime - 300) / 200, 0, 1) * Math.PI);
      const flight = THREE.MathUtils.clamp((keeperTime - 500) / 1050, 0, 1);
      const lift = flight < .58 ? Math.sin(flight / .58 * Math.PI / 2) : Math.cos((flight - .58) / .42 * Math.PI / 2);
      const jumpHeight = THREE.MathUtils.clamp(.035 + target.y * 2.44 - 1.9, .035, .55);
      keeper.root.position.x = target.x * 3.15 * dt;
      keeper.root.position.y = jumpHeight * lift;
      keeper.body.position.y = -.025 - crouch * .15;
      keeper.body.rotation.z = -target.x * (target.y > .65 ? .7 : 1.1) * dt;
      keeper.limbs.forEach(leg => leg.rotation.x = -.13 - crouch * .3 + lift * .12);
      keeper.knees.forEach(knee => knee.rotation.x = .26 + crouch * .6 + lift * .3);

      // 팔을 옆으로만 벌리지 않고, 공을 향해 어깨 위로 뻗는다.
      keeper.root.updateMatrixWorld(true);
      const catchPoint = keeper.body.worldToLocal(new THREE.Vector3(target.x * 3.66, target.y * 2.44, .45));
      keeper.arms.forEach((arm, i) => {
        const side = i === 0 ? -1 : 1;
        const dx = catchPoint.x + side * .075 - arm.position.x;
        const dy = catchPoint.y - arm.position.y;
        let angle = Math.atan2(dx, -dy);
        // 높은 공은 몸 바깥쪽으로 팔을 들어 올린 뒤 머리 위로 모은다.
        if (dy > 0 && side < 0 && angle > 0) angle -= Math.PI * 2;
        if (dy > 0 && side > 0 && angle < 0) angle += Math.PI * 2;
        arm.rotation.z = side * .55 * (1 - dt) + angle * dt;
        arm.rotation.x = 0;
      });
      keeper.elbows.forEach(elbow => elbow.rotation.x = -.8 + dt * .72);
      const endZ = outcome === 'save' ? .55 : -.8;
      ball.position.set(shot.x * 3.66 * t, .17 + (shot.y * 2.44 - .17) * t + 1.65 * 4 * t * (1-t), 11 + (endZ - 11) * t);
      ball.rotation.x = -t * Math.PI * 6; ball.rotation.z = t * Math.PI * 2;
      if (t === 1 && elapsed > KICK_AT + FLIGHT_MS) {
        const post = Math.min((elapsed - KICK_AT - FLIGHT_MS) / 400, 1);
        if (outcome === 'post' || outcome === 'save') {
          ball.position.z += post * 3; ball.position.y = Math.max(.17, ball.position.y - post * .6);
        } else if (outcome === 'goal') {
          net.position.z = -.1 * Math.sin(post * Math.PI * 4) * (1-post);
          ball.position.y = Math.max(.17, ball.position.y * (1-post));
        }
      }
      if (elapsed >= FINISH_AT) { const done = motion.done; motion = null; done(); }
    } else if (!motion && !played) {
      keeper.body.position.y = -.025 + Math.sin(now / 350) * .018;
      keeper.arms[0].rotation.x = Math.sin(now / 500) * .045;
      keeper.arms[1].rotation.x = -Math.sin(now / 500) * .045;
    }
    shadow.position.x = ball.position.x; shadow.position.z = ball.position.z;
    shadow.scale.setScalar(1 + ball.position.y * .15);
    for (const view of renderers) view.renderer.render(scene, view.camera);
    frameId = requestAnimationFrame(tick);
  }
  let played = false;
  frameId = requestAnimationFrame(tick);
  function dispose() {
    disposed = true; cancelAnimationFrame(frameId);
    observer?.disconnect();
    if (motion) { motion.done(); motion = null; }
    for (const r of renderers) { r.renderer.dispose(); r.renderer.forceContextLoss(); }
    for (const r of resources) r.dispose();
    fans.dispose();
  }
  return {
    resize,
    play(shot, dive, outcome, onStrike) { played = true; return new Promise(done => { motion = { shot, dive, outcome, onStrike, struck:false, start: performance.now(), done }; }); },
    dispose,
  };
}
