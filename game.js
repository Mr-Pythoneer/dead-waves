// ─── SCENE SETUP ────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0a0a);
scene.fog = new THREE.Fog(0x1a0a0a, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 0);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ─── LIGHTING ────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x221111, 0.8);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0x334466, 0.6);
moonLight.position.set(10, 30, 10);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 120;
moonLight.shadow.camera.left = -60;
moonLight.shadow.camera.right = 60;
moonLight.shadow.camera.top = 60;
moonLight.shadow.camera.bottom = -60;
scene.add(moonLight);

// A few eerie point lights
[[-10,3,-10],[10,3,10],[-10,3,10],[10,3,-10]].forEach(([x,y,z]) => {
  const l = new THREE.PointLight(0x661122, 1.2, 25);
  l.position.set(x, y, z);
  scene.add(l);
});

// ─── WORLD GEOMETRY ──────────────────────────────────────────────────────────
function makeMat(color, rough = 0.9, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

// Ground
const groundGeo = new THREE.PlaneGeometry(100, 100, 20, 20);
const groundMat = makeMat(0x1c1c14, 0.95);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Ground grid lines for depth
const gridHelper = new THREE.GridHelper(100, 50, 0x222200, 0x1a1a10);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Boundary walls
function makeWall(w, h, d, x, y, z, ry = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeMat(0x2a1a1a, 0.95);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

makeWall(100, 8, 1, 0, 4, -50);
makeWall(100, 8, 1, 0, 4, 50);
makeWall(1, 8, 100, -50, 4, 0);
makeWall(1, 8, 100, 50, 4, 0);

// Scattered rubble/obstacles
const obstacleBoxes = [];
const obstacleData = [
  [2,1.2,2, -8,0.6,-8], [1.5,2,1.5, 12,1,-5], [3,0.8,1, -5,0.4,12],
  [1,2.5,1, 8,1.25,8], [2,1,3, -15,0.5,3], [1.5,1.5,1.5, 15,0.75,-12],
  [4,0.6,1.5, 5,0.3,-18], [1,3,1, -20,1.5,10], [2,2,2, 20,1,-20],
  [3,1,1, -12,0.5,20], [1.5,0.8,3, 18,0.4,15],
];
obstacleData.forEach(([w,h,d, x,y,z]) => {
  const m = makeWall(w, h, d, x, y, z);
  obstacleBoxes.push(new THREE.Box3().setFromObject(m));
});

// ─── WEAPON DEFINITIONS ──────────────────────────────────────────────────────
const WEAPONS = {
  pistol: {
    name: 'PISTOL', key: 1, slot: 0,
    damage: 35, fireRate: 400, reloadTime: 1200,
    magSize: 12, reserveMax: Infinity,
    spread: 0.015, auto: false,
    color: 0x444444, length: 0.35, cost: 0,
  },
  shotgun: {
    name: 'SHOTGUN', key: 2, slot: 1,
    damage: 18, fireRate: 900, reloadTime: 2200,
    magSize: 8, reserveMax: 48,
    spread: 0.08, pellets: 7, auto: false,
    color: 0x553322, length: 0.55, cost: 400,
  },
  smg: {
    name: 'SMG', key: 3, slot: 2,
    damage: 22, fireRate: 100, reloadTime: 1600,
    magSize: 30, reserveMax: 120,
    spread: 0.04, auto: true,
    color: 0x2a3a2a, length: 0.4, cost: 600,
  },
  rifle: {
    name: 'ASSAULT RIFLE', key: 4, slot: 3,
    damage: 45, fireRate: 180, reloadTime: 2000,
    magSize: 25, reserveMax: 100,
    spread: 0.02, auto: true,
    color: 0x334433, length: 0.6, cost: 900,
  },
  sniper: {
    name: 'SNIPER', key: 5, slot: 4,
    damage: 150, fireRate: 1500, reloadTime: 2800,
    magSize: 5, reserveMax: 20,
    spread: 0.002, auto: false,
    color: 0x222244, length: 0.8, cost: 1200,
  },
  rpg: {
    name: 'RPG', key: 6, slot: 5,
    damage: 300, fireRate: 2000, reloadTime: 3000,
    magSize: 1, reserveMax: 6,
    spread: 0, auto: false, explosive: true, blastRadius: 5,
    color: 0x443322, length: 0.7, cost: 2000,
  },
};

const SHOP_ITEMS = [
  { id: 'pistol_ammo', name: 'Pistol Ammo', desc: 'Refill pistol reserve', cost: 50, type: 'ammo', weapon: 'pistol' },
  { id: 'shotgun', name: 'Shotgun', desc: '7 pellets per shot. Devastating at close range.', cost: 400, type: 'weapon', weapon: 'shotgun' },
  { id: 'smg', name: 'SMG', desc: 'Full-auto. Great for crowds.', cost: 600, type: 'weapon', weapon: 'smg' },
  { id: 'rifle', name: 'Assault Rifle', desc: 'Accurate full-auto. The workhorse.', cost: 900, type: 'weapon', weapon: 'rifle' },
  { id: 'sniper', name: 'Sniper Rifle', desc: 'One-shot most zombies. Very slow.', cost: 1200, type: 'weapon', weapon: 'sniper' },
  { id: 'rpg', name: 'RPG', desc: 'Explosive splash. Clears hordes.', cost: 2000, type: 'weapon', weapon: 'rpg' },
  { id: 'health_pack', name: 'Medkit', desc: 'Restore 50 HP', cost: 150, type: 'health' },
  { id: 'max_health', name: 'Max Health Up', desc: '+25 max HP. Stackable.', cost: 500, type: 'maxhealth' },
  { id: 'ammo_pack', name: 'Ammo Pack', desc: 'Refill ALL weapon reserves', cost: 300, type: 'ammo_all' },
];

// ─── GAME STATE ───────────────────────────────────────────────────────────────
let state = 'menu';
const player = {
  health: 100, maxHealth: 100,
  cash: 0, score: 0, kills: 0,
  yaw: 0, pitch: 0,
  vx: 0, vz: 0,
  onGround: true,
  inventory: { pistol: true },
  currentWeapon: 'pistol',
  ammo: { pistol: { mag: 12, reserve: Infinity } },
  lastShot: 0, reloading: false, reloadStart: 0,
  damageFlash: 0,
};

let wave = 1;
let zombies = [];
let bullets = [];
let particles = [];
let decals = [];
let waveActive = false;
let zombiesLeft = 0;
let shopOpen = false;
let betweenWaves = false;

// ─── WEAPON MESH (gun model in view) ─────────────────────────────────────────
const gunGroup = new THREE.Group();
camera.add(gunGroup);
scene.add(camera);

function buildGunMesh(wep) {
  gunGroup.clear();
  const def = WEAPONS[wep];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.08, def.length),
    makeMat(def.color, 0.6, 0.4)
  );
  body.position.set(0.22, -0.18, -0.35);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, def.length * 0.6, 8),
    makeMat(0x222222, 0.5, 0.8)
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.22, -0.15, -0.35 - def.length * 0.2);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.1, 0.04),
    makeMat(def.color, 0.95)
  );
  grip.position.set(0.22, -0.24, -0.28);
  gunGroup.add(body, barrel, grip);
}
buildGunMesh('pistol');

// ─── ZOMBIE BUILDER ───────────────────────────────────────────────────────────
function makeZombieMesh() {
  const g = new THREE.Group();

  const torsoMat = makeMat(0x2d4a2d, 0.9);
  const skinMat  = makeMat(0x5a7a3a, 0.85);
  const darkMat  = makeMat(0x1a2a1a, 0.95);

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28), torsoMat);
  torso.position.y = 0.95;
  torso.castShadow = true;

  // head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
  head.position.y = 1.55;
  head.castShadow = true;

  // eye glow
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2 });
  [-0.08, 0.08].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), eyeMat);
    eye.position.set(ex, 1.57, 0.185);
    g.add(eye);
  });

  // legs
  [-0.14, 0.14].forEach(lx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), darkMat);
    leg.position.set(lx, 0.33, 0);
    leg.castShadow = true;
    g.add(leg);
  });

  // arms (outstretched zombie pose)
  [-0.36, 0.36].forEach(ax => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), torsoMat);
    arm.position.set(ax, 1.05, 0.18);
    arm.rotation.x = -0.7;
    arm.castShadow = true;
    g.add(arm);
  });

  g.add(torso, head);
  return g;
}

// ─── SPAWN ZOMBIES ────────────────────────────────────────────────────────────
function spawnWave(w) {
  waveActive = true;
  const count = 5 + w * 3 + Math.floor(w * w * 0.4);
  zombiesLeft = count;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (state !== 'playing') return;
      const angle = Math.random() * Math.PI * 2;
      const dist  = 35 + Math.random() * 12;
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;

      const mesh = makeZombieMesh();
      mesh.position.set(x, 0, z);
      scene.add(mesh);

      const speed = 1.5 + w * 0.18 + Math.random() * 0.5;
      const maxHp = 60 + w * 20;
      zombies.push({
        mesh, speed,
        hp: maxHp, maxHp,
        dead: false,
        hitFlash: 0,
        legTime: Math.random() * Math.PI * 2,
        attackCooldown: 0,
        flashing: false,
      });
    }, i * (Math.max(200, 1200 - w * 60)));
  }
}

// ─── BULLET HELPERS ───────────────────────────────────────────────────────────
const bulletGeo = new THREE.SphereGeometry(0.05, 6, 6);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });

const rocketGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

function fireBullet(explosive = false) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const wepDef = WEAPONS[player.currentWeapon];
  const addSpread = () => {
    dir.x += (Math.random() - 0.5) * wepDef.spread;
    dir.y += (Math.random() - 0.5) * wepDef.spread;
    dir.z += (Math.random() - 0.5) * wepDef.spread;
    dir.normalize();
  };

  const pellets = wepDef.pellets || 1;
  for (let p = 0; p < pellets; p++) {
    const spreadDir = dir.clone();
    if (p > 0 || wepDef.spread > 0) {
      spreadDir.x += (Math.random() - 0.5) * wepDef.spread;
      spreadDir.y += (Math.random() - 0.5) * wepDef.spread;
      spreadDir.z += (Math.random() - 0.5) * wepDef.spread;
      spreadDir.normalize();
    }

    const mesh = new THREE.Mesh(explosive ? rocketGeo : bulletGeo, explosive ? rocketMat : bulletMat);
    const origin = camera.position.clone().add(new THREE.Vector3(0, -0.1, 0));
    mesh.position.copy(origin);
    if (explosive) { mesh.rotation.x = Math.PI / 2; }
    scene.add(mesh);

    bullets.push({
      mesh, dir: spreadDir.clone(),
      speed: explosive ? 18 : 60,
      damage: wepDef.damage,
      life: 1.5,
      explosive: !!explosive,
      blastRadius: wepDef.blastRadius || 0,
    });
  }
}

// ─── PARTICLES ────────────────────────────────────────────────────────────────
function spawnBlood(pos, count = 10) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(Math.random() * 0.07 + 0.02, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5 + Math.random() * 0.2, 0, 0) });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.3,(Math.random()-0.5)*0.3,(Math.random()-0.5)*0.3));
    scene.add(m);
    particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random()-0.5)*4, Math.random()*5+1, (Math.random()-0.5)*4),
      life: 0.6 + Math.random() * 0.4,
      gravity: true,
    });
  }
}

function spawnExplosion(pos) {
  for (let i = 0; i < 30; i++) {
    const geo = new THREE.SphereGeometry(Math.random() * 0.18 + 0.05, 4, 4);
    const colors = [0xff6600, 0xff3300, 0xffcc00, 0xff9900];
    const mat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random()*colors.length)] });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    const speed = Math.random() * 8 + 2;
    const dir = new THREE.Vector3(Math.random()-0.5, Math.random()*1.5, Math.random()-0.5).normalize();
    particles.push({ mesh: m, vel: dir.multiplyScalar(speed), life: 0.8 + Math.random() * 0.5, gravity: true });
  }
  // flash light
  const flash = new THREE.PointLight(0xff6600, 8, 12);
  flash.position.copy(pos);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 200);
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state !== 'playing') return;

  if (e.code === 'KeyR' && !player.reloading) startReload();
  if (e.code === 'KeyB') toggleShop();

  const slots = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];
  const weaponKeys = ['pistol','shotgun','smg','rifle','sniper','rpg'];
  slots.forEach((k, i) => {
    if (e.code === k) {
      const wk = weaponKeys[i];
      if (player.inventory[wk]) switchWeapon(wk);
    }
  });
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let mouseDown = false;
document.addEventListener('mousedown', e => {
  if (e.button === 0) mouseDown = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
});

document.addEventListener('mousemove', e => {
  if (state !== 'playing' || shopOpen) return;
  if (!document.pointerLockElement) return;
  player.yaw   -= e.movementX * 0.0018;
  player.pitch -= e.movementY * 0.0018;
  player.pitch  = Math.max(-1.2, Math.min(1.2, player.pitch));
});

canvas.addEventListener('click', () => {
  if (state === 'playing' && !shopOpen) canvas.requestPointerLock();
});

// ─── SHOOTING ────────────────────────────────────────────────────────────────
let autoFireInterval = null;

function tryShoot() {
  if (state !== 'playing' || shopOpen || player.reloading) return;
  const now = performance.now();
  const wep = WEAPONS[player.currentWeapon];
  if (now - player.lastShot < wep.fireRate) return;

  const ammo = player.ammo[player.currentWeapon];
  if (ammo.mag <= 0) { startReload(); return; }

  player.lastShot = now;
  ammo.mag--;
  fireBullet(wep.explosive);
  gunRecoil();
  updateAmmoHUD();
}

document.addEventListener('mousedown', e => {
  if (e.button !== 0 || state !== 'playing' || shopOpen) return;
  tryShoot();
  const wep = WEAPONS[player.currentWeapon];
  if (wep.auto) {
    clearInterval(autoFireInterval);
    autoFireInterval = setInterval(tryShoot, wep.fireRate);
  }
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) { clearInterval(autoFireInterval); autoFireInterval = null; }
});

function gunRecoil() {
  const tl = { y: -0.06, z: 0.04 };
  gsap(gunGroup.position, tl, 80, () => gsap(gunGroup.position, {y:0,z:0}, 120));
}

function gsap(obj, props, dur, cb) {
  const start = { ...obj };
  const t0 = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - t0) / dur);
    for (const k in props) obj[k] = start[k] + (props[k] - start[k]) * t;
    if (t < 1) requestAnimationFrame(step); else if (cb) cb();
  }
  requestAnimationFrame(step);
}

// ─── RELOAD ───────────────────────────────────────────────────────────────────
function startReload() {
  const ammo = player.ammo[player.currentWeapon];
  const wep  = WEAPONS[player.currentWeapon];
  if (ammo.mag === wep.magSize) return;
  if (ammo.reserve === 0) return;

  player.reloading = true;
  player.reloadStart = performance.now();
  document.getElementById('reload-indicator').classList.add('show');
}

function finishReload() {
  const ammo = player.ammo[player.currentWeapon];
  const wep  = WEAPONS[player.currentWeapon];
  const needed = wep.magSize - ammo.mag;

  if (ammo.reserve === Infinity) {
    ammo.mag = wep.magSize;
  } else {
    const take = Math.min(needed, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
  }

  player.reloading = false;
  document.getElementById('reload-indicator').classList.remove('show');
  document.getElementById('reload-bar').style.width = '0%';
  updateAmmoHUD();
}

// ─── WEAPON SWITCH ────────────────────────────────────────────────────────────
function switchWeapon(wk) {
  if (wk === player.currentWeapon) return;
  player.currentWeapon = wk;
  player.reloading = false;
  clearInterval(autoFireInterval);
  document.getElementById('reload-indicator').classList.remove('show');
  buildGunMesh(wk);
  updateAmmoHUD();
  updateWeaponHUD();
}

// ─── HUD UPDATES ──────────────────────────────────────────────────────────────
function updateAmmoHUD() {
  const ammo = player.ammo[player.currentWeapon];
  const res  = ammo.reserve === Infinity ? '∞' : ammo.reserve;
  document.getElementById('ammo-display').innerHTML = `${ammo.mag} / <span id="ammo-res">${res}</span>`;
}

function updateWeaponHUD() {
  document.getElementById('weapon-name').textContent = WEAPONS[player.currentWeapon].name;
}

function updateHealthHUD() {
  const pct = (player.health / player.maxHealth) * 100;
  document.getElementById('health-bar').style.width = pct + '%';
  const bar = document.getElementById('health-bar');
  bar.style.background = pct > 50
    ? 'linear-gradient(90deg,#c0392b,#e74c3c)'
    : pct > 25
    ? 'linear-gradient(90deg,#e67e22,#f39c12)'
    : 'linear-gradient(90deg,#e74c3c,#ff0000)';
}

function updateCash() {
  document.getElementById('cash-val').textContent = '$' + player.cash;
  document.getElementById('score-val').textContent = player.score;
  document.getElementById('kills-val').textContent = player.kills;
}

// ─── SHOP ────────────────────────────────────────────────────────────────────
function toggleShop() {
  shopOpen = !shopOpen;
  const el = document.getElementById('shop-overlay');
  if (shopOpen) {
    el.classList.add('open');
    if (document.pointerLockElement) document.exitPointerLock();
    renderShop();
  } else {
    el.classList.remove('open');
    canvas.requestPointerLock();
  }
}

function renderShop() {
  document.getElementById('shop-cash').textContent = 'Cash: $' + player.cash;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  SHOP_ITEMS.forEach(item => {
    const owned = item.type === 'weapon' && player.inventory[item.weapon];
    const cantAfford = player.cash < item.cost;
    const div = document.createElement('div');
    div.className = 'shop-item' + (owned ? ' owned' : '') + (cantAfford && !owned ? ' cant-afford' : '');
    div.innerHTML = `
      <h3>${item.name}</h3>
      <div class="item-desc">${item.desc}</div>
      <div class="item-price ${item.cost === 0 ? 'free' : ''}">$${item.cost}</div>
      ${owned ? '<div class="owned-tag">OWNED</div>' : ''}
    `;
    if (!owned && !cantAfford) {
      div.addEventListener('click', () => buyItem(item));
    }
    grid.appendChild(div);
  });
}

function buyItem(item) {
  if (player.cash < item.cost) return;

  if (item.type === 'weapon') {
    if (player.inventory[item.weapon]) return;
    player.inventory[item.weapon] = true;
    const wep = WEAPONS[item.weapon];
    player.ammo[item.weapon] = { mag: wep.magSize, reserve: wep.reserveMax };
    player.cash -= item.cost;
    switchWeapon(item.weapon);
  } else if (item.type === 'health') {
    player.health = Math.min(player.maxHealth, player.health + 50);
    player.cash -= item.cost;
    updateHealthHUD();
  } else if (item.type === 'maxhealth') {
    player.maxHealth += 25;
    player.health = Math.min(player.maxHealth, player.health + 25);
    player.cash -= item.cost;
    updateHealthHUD();
  } else if (item.type === 'ammo_all') {
    Object.keys(player.ammo).forEach(wk => {
      const wep = WEAPONS[wk];
      if (wep && player.inventory[wk]) {
        if (player.ammo[wk].reserve !== Infinity) {
          player.ammo[wk].reserve = Math.min(wep.reserveMax, player.ammo[wk].reserve + Math.floor(wep.reserveMax * 0.5));
        }
      }
    });
    player.cash -= item.cost;
    updateAmmoHUD();
  } else if (item.type === 'ammo') {
    const wk = item.weapon;
    if (player.inventory[wk] && player.ammo[wk].reserve !== Infinity) {
      player.ammo[wk].reserve = Math.min(WEAPONS[wk].reserveMax, player.ammo[wk].reserve + WEAPONS[wk].magSize * 3);
    }
    player.cash -= item.cost;
    updateAmmoHUD();
  }

  updateCash();
  renderShop();
}

document.getElementById('shop-close').addEventListener('click', () => {
  if (shopOpen) toggleShop();
});
document.addEventListener('keydown', e => {
  if (e.code === 'KeyB' && shopOpen) toggleShop();
});

// ─── EXPLOSION DAMAGE ─────────────────────────────────────────────────────────
function explode(pos, radius, damage) {
  spawnExplosion(pos);
  zombies.forEach(z => {
    if (z.dead) return;
    const dist = pos.distanceTo(z.mesh.position);
    if (dist < radius) {
      const falloff = 1 - dist / radius;
      damageZombie(z, damage * falloff, pos);
    }
  });
}

// ─── DAMAGE ZOMBIE ────────────────────────────────────────────────────────────
function damageZombie(z, dmg, hitPos) {
  z.hp -= dmg;
  z.hitFlash = 0.12;
  spawnBlood(hitPos || z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 6);
  if (z.hp <= 0) killZombie(z);
}

function killZombie(z) {
  if (z.dead) return;
  z.dead = true;
  scene.remove(z.mesh);
  spawnBlood(z.mesh.position.clone().add(new THREE.Vector3(0,0.5,0)), 20);

  const reward = 50 + wave * 10;
  player.cash  += reward;
  player.score += 100 + wave * 20;
  player.kills++;
  updateCash();

  zombiesLeft--;
  if (zombiesLeft <= 0 && zombies.filter(z => !z.dead).length === 0) endWave();
}

// ─── WAVE MANAGEMENT ─────────────────────────────────────────────────────────
function showWaveAnnounce(text, sub) {
  const el  = document.getElementById('wave-announce');
  const ht  = document.getElementById('wave-announce-text');
  const st  = document.getElementById('wave-announce-sub');
  ht.textContent = text;
  st.textContent = sub;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function startWave() {
  betweenWaves = false;
  document.getElementById('wave-num').textContent = wave;
  zombies = zombies.filter(z => { if (z.dead) return false; scene.remove(z.mesh); return false; });
  zombies = [];
  bullets.forEach(b => scene.remove(b.mesh)); bullets = [];
  showWaveAnnounce('WAVE ' + wave, wave === 1 ? 'Survive!' : 'They keep coming...');
  spawnWave(wave);
}

function endWave() {
  waveActive = false;
  betweenWaves = true;
  showWaveAnnounce('WAVE CLEAR', 'Visit the shop!');
  toggleShop();
  wave++;
  setTimeout(() => {
    if (shopOpen) return; // let player close manually
    startWave();
  }, 8000);
}

document.getElementById('shop-close').addEventListener('click', () => {
  if (betweenWaves && !waveActive) {
    setTimeout(() => { if (!shopOpen) startWave(); }, 500);
  }
});

// ─── PLAYER DAMAGE ────────────────────────────────────────────────────────────
function hurtPlayer(dmg) {
  player.health -= dmg;
  player.damageFlash = 0.3;
  updateHealthHUD();
  if (player.health <= 0) gameOver();
}

// ─── COLLISION (simple AABB vs player) ───────────────────────────────────────
const playerBox = new THREE.Box3();
const playerSize = new THREE.Vector3(0.4, 1.8, 0.4);

function collidesWithWorld(pos) {
  playerBox.setFromCenterAndSize(pos.clone().add(new THREE.Vector3(0,0.9,0)), playerSize);
  for (const ob of obstacleBoxes) {
    if (playerBox.intersectsBox(ob)) return true;
  }
  if (Math.abs(pos.x) > 49.5 || Math.abs(pos.z) > 49.5) return true;
  return false;
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
let lastTime = performance.now();

function tick() {
  requestAnimationFrame(tick);
  const now  = performance.now();
  const dt   = Math.min((now - lastTime) / 1000, 0.05);
  lastTime   = now;

  if (state !== 'playing') { renderer.render(scene, camera); return; }

  // ── Camera rotation
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // ── Player movement
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed  = sprint ? 7 : 4.5;
  const fwd    = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right  = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move   = new THREE.Vector3();

  if (keys['KeyW'] || keys['ArrowUp'])    move.add(fwd);
  if (keys['KeyS'] || keys['ArrowDown'])  move.sub(fwd);
  if (keys['KeyA'] || keys['ArrowLeft'])  move.sub(right);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);

  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

  const tryX = camera.position.clone().add(new THREE.Vector3(move.x, 0, 0));
  if (!collidesWithWorld(tryX)) camera.position.x = tryX.x;
  const tryZ = camera.position.clone().add(new THREE.Vector3(0, 0, move.z));
  if (!collidesWithWorld(tryZ)) camera.position.z = tryZ.z;
  camera.position.y = 1.7;

  // ── Bob
  if (move.lengthSq() > 0) {
    const bobSpeed = sprint ? 12 : 8;
    const bobAmt   = sprint ? 0.04 : 0.025;
    gunGroup.position.y += Math.sin(now * 0.001 * bobSpeed) * bobAmt * dt * 20;
  }

  // ── Reload progress
  if (player.reloading) {
    const wep = WEAPONS[player.currentWeapon];
    const t = (now - player.reloadStart) / wep.reloadTime;
    document.getElementById('reload-bar').style.width = (Math.min(t, 1) * 100) + '%';
    if (t >= 1) finishReload();
  }

  // ── Auto-fire held
  if (mouseDown && WEAPONS[player.currentWeapon].auto && !player.reloading) {
    // handled by interval
  }

  // ── Bullets
  const raycaster = new THREE.Raycaster();
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;

    const oldPos = b.mesh.position.clone();
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);

    // Hit world bounds / obstacles
    let hitWorld = false;
    if (Math.abs(b.mesh.position.x) > 50 || Math.abs(b.mesh.position.z) > 50 || b.mesh.position.y < 0) hitWorld = true;
    if (!hitWorld) {
      const bBox = new THREE.Box3().setFromCenterAndSize(b.mesh.position, new THREE.Vector3(0.1,0.1,0.1));
      for (const ob of obstacleBoxes) if (ob.intersectsBox(bBox)) { hitWorld = true; break; }
    }

    if (hitWorld || b.life <= 0) {
      if (b.explosive) explode(b.mesh.position, b.blastRadius, b.damage);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    // Hit zombies
    let hit = false;
    for (const z of zombies) {
      if (z.dead) continue;
      const zBox = new THREE.Box3().setFromObject(z.mesh);
      const bBox = new THREE.Box3().setFromCenterAndSize(b.mesh.position, new THREE.Vector3(0.15,0.15,0.15));
      if (zBox.intersectsBox(bBox)) {
        if (b.explosive) {
          explode(b.mesh.position, b.blastRadius, b.damage);
        } else {
          damageZombie(z, b.damage, b.mesh.position.clone());
        }
        hit = true;
        break;
      }
    }
    if (hit) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // ── Zombies AI
  const playerPos = camera.position.clone();
  for (const z of zombies) {
    if (z.dead) continue;
    z.legTime += dt * 4;

    const toPlayer = playerPos.clone().sub(z.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist > 0.1) {
      toPlayer.normalize();
      const move = toPlayer.clone().multiplyScalar(z.speed * dt);
      z.mesh.position.add(move);
      z.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    // leg animation
    z.mesh.children.forEach((c, ci) => {
      if (ci < 2) { // legs
        c.rotation.x = Math.sin(z.legTime + ci * Math.PI) * 0.4;
      }
    });

    // hit flash
    if (z.hitFlash > 0) {
      z.hitFlash -= dt;
      if (!z.flashing) {
        z.flashing = true;
        z.mesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color) {
            c.material.userData.origColor = c.material.color.getHex();
            c.material.color.set(0xffffff);
          }
        });
      }
    } else if (z.flashing) {
      z.flashing = false;
      z.mesh.traverse(c => {
        if (c.isMesh && c.material && c.material.color && c.material.userData.origColor !== undefined) {
          c.material.color.set(c.material.userData.origColor);
        }
      });
    }

    // Attack player
    if (dist < 1.1) {
      z.attackCooldown -= dt;
      if (z.attackCooldown <= 0) {
        hurtPlayer(12 + wave * 1.5);
        z.attackCooldown = 0.9;
      }
    }
  }

  // ── Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i,1); continue; }
    if (p.gravity) p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = p.life;
    if (p.mesh.position.y < 0) { p.mesh.position.y = 0; p.vel.y *= -0.3; }
  }

  // ── Damage flash
  if (player.damageFlash > 0) {
    player.damageFlash -= dt;
    document.getElementById('damage-overlay').style.opacity = player.damageFlash > 0 ? Math.min(player.damageFlash * 2, 0.85) : 0;
  }

  // ── Clean dead
  zombies = zombies.filter(z => !z.dead);

  renderer.render(scene, camera);
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function gameOver() {
  state = 'dead';
  document.exitPointerLock();
  document.getElementById('go-wave').textContent  = wave;
  document.getElementById('go-kills').textContent = player.kills;
  document.getElementById('go-score').textContent = player.score;
  document.getElementById('gameover').classList.add('show');
}

// ─── INIT / RESTART ───────────────────────────────────────────────────────────
function initGame() {
  // Reset player
  player.health = 100; player.maxHealth = 100;
  player.cash = 0; player.score = 0; player.kills = 0;
  player.yaw = 0; player.pitch = 0;
  player.inventory = { pistol: true };
  player.currentWeapon = 'pistol';
  player.ammo = { pistol: { mag: 12, reserve: Infinity } };
  player.reloading = false; player.damageFlash = 0;
  camera.position.set(0, 1.7, 0);

  // Clear scene objects
  zombies.forEach(z => scene.remove(z.mesh)); zombies = [];
  bullets.forEach(b => scene.remove(b.mesh)); bullets = [];
  particles.forEach(p => scene.remove(p.mesh)); particles = [];

  wave = 1;
  waveActive = false;
  betweenWaves = false;
  shopOpen = false;
  document.getElementById('shop-overlay').classList.remove('open');
  document.getElementById('gameover').classList.remove('show');

  buildGunMesh('pistol');
  updateAmmoHUD();
  updateWeaponHUD();
  updateHealthHUD();
  updateCash();
  document.getElementById('wave-num').textContent = 1;

  state = 'playing';
  canvas.requestPointerLock();
  startWave();
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('menu').style.display = 'none';
  initGame();
});
document.getElementById('restart-btn').addEventListener('click', () => {
  initGame();
});

tick();
