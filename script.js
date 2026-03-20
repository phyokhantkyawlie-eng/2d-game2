// =====================
// SETUP
// =====================
const game        = document.getElementById("game");
const player      = document.getElementById("player");
const hpVal       = document.getElementById("hp-val");
const waveVal     = document.getElementById("wave-val");
const joystickZone = document.getElementById("joystick-zone");
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");
const abilityBtn   = document.getElementById("ability-btn");

let W = window.innerWidth;
let H = window.innerHeight;
window.addEventListener("resize", () => { W = window.innerWidth; H = window.innerHeight; });

// Player state
let x = W / 2 - 20;
let y = H / 2 - 20;
const speed = 4;
let playerHP = 3;

// Mouse / aim position
let mouseX = W / 2;
let mouseY = H / 2;

const enemies = [];
const bullets  = [];
let wave = 1;

// =====================
// OBSTACLES
// =====================
function getObstacles() {
  return [
    { x: W * 0.15,           y: H * 0.20,           w: 220, h: 110 },
    { x: W - W*0.12 - 180,   y: H * 0.55,           w: 180, h: 90  },
    { x: W * 0.38,           y: H - H*0.10 - 100,   w: 260, h: 100 },
    { x: W * 0.60,           y: H * 0.18,           w: 70,  h: 55  },
    { x: W * 0.28,           y: H * 0.65,           w: 55,  h: 45  },
    { x: W - W*0.25 - 80,    y: H * 0.30,           w: 80,  h: 60  },
    { x: W * 0.72,           y: H - H*0.28 - 40,    w: 50,  h: 40  },
    { x: W * 0.05,           y: H * 0.05,           w: 50,  h: 60  },
    { x: W * 0.45,           y: H * 0.08,           w: 50,  h: 60  },
    { x: W - W*0.05 - 50,    y: H * 0.05,           w: 50,  h: 60  },
    { x: W * 0.05,           y: H - H*0.08 - 60,    w: 50,  h: 60  },
    { x: W - W*0.05 - 50,    y: H - H*0.08 - 60,   w: 50,  h: 60  },
    { x: W * 0.82,           y: H * 0.48,           w: 50,  h: 60  },
  ];
}

function collidesWithAnyObstacle(rx, ry, rw, rh) {
  return getObstacles().some(o =>
    rx < o.x + o.w && rx + rw > o.x &&
    ry < o.y + o.h && ry + rh > o.y
  );
}

// =====================
// KEYBOARD INPUT
// =====================
const keys = {};
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "e" || e.key === "E") shootAllDirections();
});
document.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

game.addEventListener("mousemove", e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Desktop click to shoot (ignore clicks on mobile controls)
game.addEventListener("click", e => {
  if (e.target.closest("#mobile-controls")) return;
  shoot();
});

// =====================
// MOBILE — JOYSTICK
// =====================
let joystickActive = false;
let joystickTouchId = null;
let joystickDx = 0;
let joystickDy = 0;
const joystickRadius = 38; // max knob travel

function getJoystickCenter() {
  const r = joystickBase.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

joystickZone.addEventListener("touchstart", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystickTouchId = touch.identifier;
  joystickActive = true;
  updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

joystickZone.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      updateJoystick(t.clientX, t.clientY);
    }
  }
}, { passive: false });

joystickZone.addEventListener("touchend", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      joystickActive = false;
      joystickDx = 0;
      joystickDy = 0;
      joystickKnob.style.transform = "translate(-50%, -50%)";
    }
  }
}, { passive: false });

function updateJoystick(tx, ty) {
  const { cx, cy } = getJoystickCenter();
  let dx = tx - cx;
  let dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > joystickRadius) {
    dx = (dx / dist) * joystickRadius;
    dy = (dy / dist) * joystickRadius;
  }
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joystickDx = dx / joystickRadius; // -1 to 1
  joystickDy = dy / joystickRadius;
}

// =====================
// MOBILE — TAP TO SHOOT
// =====================
game.addEventListener("touchstart", e => {
  for (const touch of e.changedTouches) {
    // Skip if touch is on joystick zone or ability button
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.closest("#joystick-zone")) continue;
    if (el && el.closest("#ability-btn"))  continue;

    // Shoot toward tap position
    const tx = touch.clientX;
    const ty = touch.clientY;
    const bx = x + 20;
    const by = y + 20;
    const ddx = tx - bx;
    const ddy = ty - by;
    const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    spawnBullet(bx, by, (ddx / d) * 7, (ddy / d) * 7);
  }
}, { passive: true });

// =====================
// MOBILE — ABILITY BUTTON
// =====================
abilityBtn.addEventListener("touchstart", e => {
  e.preventDefault();
  shootAllDirections();
}, { passive: false });

// Also support click for desktop testing
abilityBtn.addEventListener("click", e => {
  e.stopPropagation();
  shootAllDirections();
});

// =====================
// SHOOTING
// =====================
function spawnBullet(bx, by, dx, dy) {
  const bullet = document.createElement("div");
  bullet.className = "bullet";
  bullet.x  = bx; bullet.y  = by;
  bullet.dx = dx; bullet.dy = dy;
  bullet.style.left = bx + "px";
  bullet.style.top  = by + "px";
  game.appendChild(bullet);
  bullets.push(bullet);
}

function shoot() {
  const bx = x + 20, by = y + 20;
  const dx = mouseX - bx, dy = mouseY - by;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  spawnBullet(bx, by, (dx/dist)*7, (dy/dist)*7);
}

function shootAllDirections() {
  const n = 36;
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = step * i;
    spawnBullet(x+20, y+20, Math.cos(a)*7, Math.sin(a)*7);
  }
}

// =====================
// ENEMIES & WAVES
// =====================
function spawnEnemy() {
  const enemy = document.createElement("div");
  enemy.className = "enemy";

  let ex, ey;
  const side = Math.floor(Math.random() * 4);
  if      (side === 0) { ex = Math.random() * W; ey = 0; }
  else if (side === 1) { ex = Math.random() * W; ey = H - 32; }
  else if (side === 2) { ex = 0;      ey = Math.random() * H; }
  else                 { ex = W - 32; ey = Math.random() * H; }

  let tries = 0;
  while (collidesWithAnyObstacle(ex, ey, 32, 32) && tries < 20) {
    ex = (ex + 40) % (W - 32);
    ey = (ey + 40) % (H - 32);
    tries++;
  }

  enemy.x = ex; enemy.y = ey;
  enemy.style.left = ex + "px";
  enemy.style.top  = ey + "px";
  game.appendChild(enemy);
  enemies.push(enemy);
}

function spawnWave() {
  for (let i = 0; i < wave * 2; i++) spawnEnemy();
  wave++;
  waveVal.textContent = wave;
}

spawnWave();
setInterval(spawnWave, 4000);

// =====================
// AMBIENT PARTICLES
// =====================
function spawnParticle() {
  const p = document.createElement("div");
  p.className = "particle";
  p.style.left = Math.random() * W + "px";
  p.style.top  = (H * 0.1 + Math.random() * H * 0.8) + "px";
  const dur = 4 + Math.random() * 5;
  p.style.animationDuration = dur + "s";
  p.style.animationDelay = (Math.random() * 2) + "s";
  const colors = ["rgba(180,255,120,0.8)", "rgba(255,255,150,0.7)", "rgba(120,255,200,0.6)"];
  const c = colors[Math.floor(Math.random() * colors.length)];
  p.style.background = c;
  p.style.boxShadow  = `0 0 6px 2px ${c}`;
  game.appendChild(p);
  setTimeout(() => p.remove(), (dur + 3) * 1000);
}
setInterval(spawnParticle, 500);

// =====================
// GAME LOOP
// =====================
function update() {
  // --- PLAYER MOVEMENT ---
  let nx = x, ny = y;

  // Keyboard
  if (keys["w"] || keys["arrowup"])    ny -= speed;
  if (keys["s"] || keys["arrowdown"])  ny += speed;
  if (keys["a"] || keys["arrowleft"])  nx -= speed;
  if (keys["d"] || keys["arrowright"]) nx += speed;

  // Joystick (mobile) — normalize diagonal
  if (joystickActive) {
    nx += joystickDx * speed;
    ny += joystickDy * speed;
  }

  nx = Math.max(0, Math.min(W - 40, nx));
  ny = Math.max(0, Math.min(H - 40, ny));

  if (!collidesWithAnyObstacle(nx, y, 40, 40)) x = nx;
  if (!collidesWithAnyObstacle(x, ny, 40, 40)) y = ny;

  player.style.left = x + "px";
  player.style.top  = y + "px";

  // --- ENEMIES ---
  for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
    const enemy = enemies[eIndex];
    const dx = (x + 20) - (enemy.x + 16);
    const dy = (y + 20) - (enemy.y + 16);
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    const enx = enemy.x + (dx/dist) * 0.9;
    const eny = enemy.y + (dy/dist) * 0.9;

    if (!collidesWithAnyObstacle(enx, enemy.y, 32, 32)) enemy.x = enx;
    if (!collidesWithAnyObstacle(enemy.x, eny, 32, 32)) enemy.y = eny;

    enemy.x = Math.max(0, Math.min(W - 32, enemy.x));
    enemy.y = Math.max(0, Math.min(H - 32, enemy.y));

    enemy.style.left = enemy.x + "px";
    enemy.style.top  = enemy.y + "px";

    // Player hit
    if (
      x < enemy.x + 32 && x + 40 > enemy.x &&
      y < enemy.y + 32 && y + 40 > enemy.y
    ) {
      enemy.remove();
      enemies.splice(eIndex, 1);
      playerHP--;
      hpVal.textContent = playerHP;
      if (playerHP <= 0) {
        setTimeout(() => { alert("You died 😿"); location.reload(); }, 50);
        return;
      }
    }
  }

  // --- BULLETS ---
  for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
    const bullet = bullets[bIndex];
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
    bullet.style.left = bullet.x + "px";
    bullet.style.top  = bullet.y + "px";

    if (bullet.x < -10 || bullet.x > W+10 || bullet.y < -10 || bullet.y > H+10) {
      bullet.remove(); bullets.splice(bIndex, 1); continue;
    }
    if (collidesWithAnyObstacle(bullet.x, bullet.y, 8, 8)) {
      bullet.remove(); bullets.splice(bIndex, 1); continue;
    }

    let dead = false;
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
      const enemy = enemies[eIndex];
      if (
        bullet.x < enemy.x + 32 && bullet.x + 8 > enemy.x &&
        bullet.y < enemy.y + 32 && bullet.y + 8 > enemy.y
      ) {
        enemy.remove();  enemies.splice(eIndex, 1);
        bullet.remove(); bullets.splice(bIndex, 1);
        dead = true; break;
      }
    }
    if (dead) continue;
  }

  requestAnimationFrame(update);
}

update();
