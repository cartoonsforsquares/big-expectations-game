//Expectations: pick Olivia or Chappell, then beat up the Loser Dudes walking in from both sides.
//PUNCH and KICK buttons. She always turns to the closest dude (the bouncing arrow marks him).
//A punch sends that dude flying; a kick reaches further and knocks every dude on that side apart,
//but takes longer to recover from.
//A dude who reaches you costs a heart. Three hearts.

// ---------- Settings ----------

//Everything is laid out on a 390 x 844 phone-shaped frame, scaled to fit the window
const VW = 390, VH = 844;
const GROUND = 615;          //where everyone's feet touch
const PLAYER_H = 340;        //player height on screen
const DUDE_H = 285;          //dude height on screen
const HEARTS = 3;

const PUNCH_MS = 170, KICK_MS = 260;  //how long the punch / kick frame shows
const PUNCH_GAP = 110, KICK_GAP = 420; //how soon she can attack again after each
const WHIFF_MS = 230;        //missing everything locks attacks this long
const HURT_MS = 900;         //can't be hurt again for this long

const SPAWN_START = 1500, SPAWN_MIN = 520, SPAWN_FASTER = 24;  //ms between dudes, shrinking per KO
const SPEED_START = 58, SPEED_MAX = 150, SPEED_FASTER = 2.2;   //dude walking speed, px per second
const MAX_WALKERS = 4;

const DUDE_PIECES = ['legL', 'legR', 'upper'];   //drawn back to front; only the legs move
//PUNCH and KICK buttons along the bottom
const BTNS = [{ id: 'punch', label: 'PUNCH', x: 105, col: '#F1D62E' }, { id: 'kick', label: 'KICK', x: 285, col: '#FFFFFF' }];
const BTN_Y = 688, BTN_W = 158, BTN_H = 66;
const PINK = '#F25FBF', YELLOW = '#F1D62E', INK = '#281F1C';
const CHAR_IDS = ['olivia', 'chappell'];
const NAMES = { olivia: 'OLIVIA', chappell: 'CHAPPELL' };

// ---------- State ----------

let man, bgImg, retryPaper, scorePaper, monoFont;
const CH = {}, DUDE = { faceLeft: {}, faceRight: {} };
let sc = 1, ox = 0, oy = 0;
let state = 'select';        //'select', 'picked', 'play', 'over'
let pick = null, pickedAt = 0;
let player, dudes = [], bits = [], stickers = [], puffs = [];
let hearts = HEARTS, kos = 0, lastSpawn = 0, overAt = 0, best = 0, newBest = false;
let shakeUntil = 0, pressedBtn = null, pressedAt = 0;

function preload() {
  man = loadJSON('assets/manifest.json');
  bgImg = loadImage('assets/background.webp');
  retryPaper = loadImage('assets/retry-paper.webp');
  scorePaper = loadImage('assets/score-paper-wide.webp');
  monoFont = loadFont('assets/GeistMono-Bold.ttf');
  for (const id of CHAR_IDS) {
    CH[id] = {};
    for (const f of ['stand', 'punch', 'kick']) CH[id][f] = loadImage(`assets/${id}-${f}.webp`);
  }
  //Loser Dude.png faces left (walks in from the right); Loser Dude_Flipped.png faces right
  for (const v of ['faceLeft', 'faceRight'])
    for (const n of DUDE_PIECES) DUDE[v][n] = loadImage(`assets/dude-${v}-${n}.webp`);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  fitFrame();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitFrame();
}

function fitFrame() {
  sc = min(width / VW, height / VH);
  ox = (width - VW * sc) / 2;
  oy = (height - VH * sc) / 2;
}

//Size helpers: how big each character's art is drawn, and her reach / width on screen
function charScale(id) { return PLAYER_H / man.chars[id].height; }
function dudeScale() { return DUDE_H / man.dude.faceLeft._height; }
function reachOf(id, move) { return man.chars[id].reach[move] * charScale(id); }
function halfOf(id) { return man.chars[id].halfWidth * charScale(id); }
function dudeHalf() { return man.dude.faceLeft._halfWidth * 0.62 * dudeScale(); }   //his body, not counting his hands
function dudeView(d) { return d.side > 0 ? 'faceLeft' : 'faceRight'; }   //always facing her
function contactDist() { return halfOf(player.id) * 0.8 + dudeHalf() * 0.8; }

// ---------- Main loop ----------

function draw() {
  drawBackground();
  push();
  translate(ox, oy); scale(sc);
  if (millis() < shakeUntil) translate(random(-5, 5), random(-4, 4));

  if (state === 'select' || state === 'picked') drawSelect();
  else {
    if (state === 'play') { spawnDudes(); updatePlayer(); }
    updateDudes();
    if (state === 'play') { styledText('EXPECTATIONS', VW / 2, 58, 30); drawHearts(); }
    for (const d of dudes) if (d.mode === 'walk' || d.mode === 'bonk') drawWalker(d);
    drawPlayer();
    for (const d of dudes) if (d.mode === 'fly') drawWalker(d);
    if (state === 'play') drawTargetArrow();
    drawBits();
    drawPuffs();
    drawStickers();
    if (state === 'play') { drawButtons(); drawScore(); }
    if (state === 'over') drawOver();
  }
  pop();
}

//The pink background covers the whole window, not just the phone frame
function drawBackground() {
  const s = max(width / bgImg.width, height / bgImg.height);
  imageMode(CENTER);
  image(bgImg, width / 2, height / 2, bgImg.width * s, bgImg.height * s);
  imageMode(CORNER);
}

// ---------- Character select ----------

const SEL = { olivia: { x: 105, flip: 1 }, chappell: { x: 285, flip: -1 } };
const SEL_GROUND = 585, SEL_H = 300;

function drawSelect() {
  styledText('EXPECTATIONS', VW / 2, 92, 40);
  const t = millis() / 1000;
  for (const id of CHAR_IDS) {
    const s = SEL[id];
    let lift = 0, alpha = 1;
    if (state === 'picked') {
      const u = (millis() - pickedAt) / 600;
      if (id === pick) lift = sin(min(u, 1) * PI) * 40;
      else alpha = max(0, 1 - u * 2);
    } else lift = abs(sin(t * 3 + (id === 'olivia' ? 0 : 1.6))) * 6;
    push();
    drawingContext.globalAlpha = alpha;
    noStroke(); fill(40, 31, 28, 50); ellipse(s.x, SEL_GROUND + 4, 120 - lift, 14);
    drawCharFrame(id, 'stand', s.x, SEL_GROUND - lift, SEL_H / man.chars[id].height, s.flip);
    styledText(NAMES[id], s.x, SEL_GROUND + 48, id === 'chappell' ? 24 : 26);
    pop();
  }
  if (state === 'select') styledText('TAP TO PLAY', VW / 2, 735, 20, '#FFFFFF', 2);
  if (state === 'picked' && millis() - pickedAt > 650) startGame(pick);
}

//Draw one of her frames with her feet at (x, y). flip -1 faces left.
function drawCharFrame(id, frame, x, y, s, flip) {
  const img = CH[id][frame], a = man.chars[id].anchor;
  push();
  translate(x, y); scale(flip * s, s);
  image(img, -a[0], -a[1]);
  pop();
}

// ---------- Game ----------

function startGame(id) {
  player = { id, dir: 1, move: null, moveAt: 0, readyAt: 0, whiffUntil: 0, hurtAt: -9999 };
  dudes = []; bits = []; stickers = []; puffs = [];
  hearts = HEARTS; kos = 0; lastSpawn = millis() - SPAWN_START + 600; newBest = false;
  best = loadBest(id);
  state = 'play';
}

function spawnDudes() {
  const walkers = dudes.filter(d => d.mode === 'walk' || d.mode === 'bonk').length;
  const every = max(SPAWN_MIN, SPAWN_START - kos * SPAWN_FASTER);
  if (millis() - lastSpawn < every || walkers >= MAX_WALKERS) return;
  lastSpawn = millis();
  const side = random() < 0.5 ? -1 : 1;
  //off the edge of the window, so they walk in on wide screens too
  const edge = side < 0 ? -ox / sc - 70 : VW + ox / sc + 70;
  dudes.push({ side, x: edge, y: GROUND, mode: 'walk', step: random(TWO_PI),
    speed: min(SPEED_MAX, SPEED_START + kos * SPEED_FASTER) + random(-8, 8), stunUntil: 0,
    vx: 0, vy: 0, a: 0, spin: 0 });
}

function updatePlayer() {
  //between hits she keeps turning to face whoever is closest
  const t = target();
  if (t && !player.move) player.dir = Math.sign(t.x - VW / 2) || player.dir;
  if (player.move && millis() - player.moveAt > (player.move === 'kick' ? KICK_MS : PUNCH_MS)) player.move = null;
}

function updateDudes() {
  const dt = min(deltaTime, 50) / 1000;
  const cx = VW / 2;
  for (const d of dudes) {
    if (d.mode === 'fly') {
      d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.spin * dt; d.step += dt * 30;
      continue;
    }
    if (d.mode === 'bonk') {               //knocked back after hitting her
      d.x += d.vx * dt; d.vx *= 0.9;
      if (millis() > d.stunUntil) d.mode = 'walk';
      continue;
    }
    if (state !== 'play') continue;         //frozen once the game ends
    const target = cx + d.side * contactDist();
    if ((d.x - target) * d.side > 0) { d.x -= d.side * d.speed * dt; d.step += dt * d.speed / 9; }
    else hurtPlayer(d);
  }
  dudes = dudes.filter(d => d.y < VH + 300 && abs(d.x - cx) < VW + ox / sc + 300);
}

function hurtPlayer(d) {
  //he shoves her, then bounces back a little dazed
  d.mode = 'bonk'; d.vx = d.side * 520; d.stunUntil = millis() + 450;
  if (millis() - player.hurtAt < HURT_MS) return;
  player.hurtAt = millis();
  hearts--;
  shakeUntil = millis() + 250;
  buzz(90);
  if (hearts <= 0) endGame();
}

function endGame() {
  state = 'over'; overAt = millis();
  if (kos > best) { best = kos; newBest = kos > 0; saveBest(player.id, best); }
}

//Tap a side: punch, punch, kick toward it
//The dude she's aiming at: whoever is closest
function target() {
  let best = null;
  for (const d of dudes) {
    if (d.mode !== 'walk' && d.mode !== 'bonk') continue;
    if (!best || abs(d.x - VW / 2) < abs(best.x - VW / 2)) best = d;
  }
  return best;
}

//PUNCH or KICK toward the closest dude
function attack(move) {
  const now = millis();
  if (now < player.readyAt || now < player.whiffUntil) return;
  const t = target();
  const side = t ? Math.sign(t.x - VW / 2) || player.dir : player.dir;
  player.dir = side; player.move = move; player.moveAt = now;
  player.readyAt = now + (move === 'kick' ? KICK_GAP : PUNCH_GAP);

  //who's in range on that side: anyone whose near edge the fist / foot reaches
  const cx = VW / 2, reach = reachOf(player.id, move) + 8;
  const inRange = dudes.filter(d => (d.mode === 'walk' || d.mode === 'bonk') &&
    Math.sign(d.x - cx) === side && abs(d.x - cx) - dudeHalf() <= reach)
    .sort((a, b) => abs(a.x - cx) - abs(b.x - cx));
  if (!inRange.length) { player.whiffUntil = now + WHIFF_MS; return; }

  const hit = move === 'kick' ? inRange : [inRange[0]];
  for (const d of hit) {
    kos++;
    if (move === 'kick') breakApart(d, side); else launch(d, side);
    poof(d.x - side * dudeHalf() * 0.6, GROUND - DUDE_H * 0.55);
  }
  stickers.push({ x: cx + side * 110, y: GROUND - PLAYER_H * 0.78, at: now,
    word: move === 'kick' ? 'BOOM' : random(['POW', 'BAM', 'WHAM']) });
  buzz(move === 'kick' ? 45 : 25);
}

//Punch: he flies off spinning, arms and legs flailing
function launch(d, side) {
  d.mode = 'fly'; d.vx = side * random(420, 560); d.vy = -random(560, 760); d.spin = side * random(7, 12);
}

//Kick: he comes apart: top half and both legs fly off separately
function breakApart(d, side) {
  d.mode = 'gone';
  const s = dudeScale(), v = dudeView(d);
  for (const n of DUDE_PIECES) {
    const p = man.dude[v][n];
    bits.push({ n, v, x: d.x + p.pivot[0] * s, y: d.y + p.pivot[1] * s,
      vx: side * random(260, 620) + p.pivot[0] * 2, vy: -random(n === 'upper' ? 620 : 420, n === 'upper' ? 860 : 760),
      a: 0, spin: random(-12, 12) });
  }
  dudes = dudes.filter(x => x !== d);
}

// ---------- Drawing the player ----------

function drawPlayer() {
  const id = player.id, s = charScale(id);
  const hurt = millis() - player.hurtAt < HURT_MS;
  if (state === 'play' && hurt && floor(millis() / 80) % 2 === 0) return;   //blink while hurt
  const lunge = player.move ? (player.move === 'kick' ? 6 : 12) : 0;
  const bob = player.move || state === 'over' ? 0 : abs(sin(millis() / 1000 * 5)) * 4;
  const x = VW / 2 + player.dir * lunge;
  noStroke(); fill(40, 31, 28, 55); ellipse(VW / 2, GROUND + 4, halfOf(id) * 2.2, 16);
  drawCharFrame(id, player.move || 'stand', x, GROUND - bob, s, player.dir);
}

// ---------- Drawing the dudes ----------

//Draw a dude with his legs swung (degrees, from the hip). His top half never moves on its own.
function drawDudeRig(x, y, v, pose) {
  const s = dudeScale();
  push();
  translate(x, y); scale(s);
  for (const n of DUDE_PIECES) {
    const p = man.dude[v][n];
    push();
    translate(p.pivot[0], p.pivot[1]);
    rotate(radians(pose[n] || 0));
    image(DUDE[v][n], p.pos[0] - p.pivot[0], p.pos[1] - p.pivot[1]);
    pop();
  }
  pop();
}

function drawWalker(d) {
  let pose, x = d.x, y = d.y;
  if (d.mode === 'walk') {
    const sw = sin(d.step);
    pose = { legL: sw * 18, legR: -sw * 18 };
    y -= abs(cos(d.step)) * 4;
  } else if (d.mode === 'bonk') {
    pose = { legL: -14 * d.side, legR: 10 * d.side };
  } else {                                  //flying: legs kick wildly
    const f = sin(d.step);
    pose = { legL: f * 40, legR: -f * 40 };
  }
  push();
  noStroke(); fill(40, 31, 28, d.mode === 'fly' ? 0 : 45); ellipse(x, GROUND + 4, dudeHalf() * 2, 12);
  if (d.mode === 'fly') {
    //spin around his middle
    translate(x, y - DUDE_H * 0.5); rotate(d.a); translate(-x, -(y - DUDE_H * 0.5));
  }
  drawDudeRig(x, y, dudeView(d), pose);
  pop();
}

//Pieces from a kicked dude
function drawBits() {
  const dt = min(deltaTime, 50) / 1000, s = dudeScale();
  bits = bits.filter(b => b.y < VH + 300);
  for (const b of bits) {
    b.vy += 1500 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.spin * dt;
    const p = man.dude[b.v][b.n];
    push();
    translate(b.x, b.y); rotate(b.a); scale(s);
    image(DUDE[b.v][b.n], p.pos[0] - p.pivot[0], p.pos[1] - p.pivot[1]);
    pop();
  }
}

// ---------- Effects ----------

function poof(x, y) {
  for (let i = 0; i < 7; i++) {
    const a = random(TWO_PI), v = random(60, 160);
    puffs.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, r: random(10, 20), at: millis() });
  }
}

function drawPuffs() {
  const dt = min(deltaTime, 50) / 1000;
  puffs = puffs.filter(p => millis() - p.at < 500);
  for (const p of puffs) {
    const t = (millis() - p.at) / 500;
    p.x += p.vx * dt; p.y += p.vy * dt;
    push();
    drawingContext.globalAlpha = 1 - t;
    fill('#FFF6E8'); stroke(INK); strokeWeight(1.5);
    circle(p.x, p.y, p.r * (1 + t));
    pop();
  }
  noStroke();
}

function drawStickers() {
  stickers = stickers.filter(s => millis() - s.at < 650);
  for (const s of stickers) {
    const t = (millis() - s.at) / 650;
    const grow = t < 0.15 ? 0.3 + 0.7 * t / 0.15 : 1;
    push();
    drawingContext.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
    translate(s.x, s.y); rotate(-0.15);
    drawBurst(0, 0, 44 * grow);
    styledText(s.word, 0, 2, (s.word.length > 3 ? 17 : 21) * grow, '#FFFFFF', 2);
    pop();
  }
}

function drawBurst(x, y, r) {
  fill(YELLOW); stroke(INK); strokeWeight(3); strokeJoin(ROUND);
  beginShape();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TWO_PI, rr = i % 2 ? r * 0.68 : r;
    vertex(x + cos(a) * rr, y + sin(a) * rr);
  }
  endShape(CLOSE);
  noStroke();
}

// ---------- UI ----------

//Yellow headline text with a dark outline and a 3D shadow falling down-left
function styledText(str, x, y, size, fillCol = YELLOW, depth = size * 0.1) {
  textFont('KCBubbleShack'); textSize(size); textAlign(CENTER, CENTER);
  stroke(INK); strokeWeight(size * 0.12); strokeJoin(ROUND); fill(INK);
  for (let i = depth; i > 0; i -= 0.5) text(str, x - i, y + i);
  fill(fillCol); text(str, x, y);
  noStroke();
}

function drawHearts() {
  for (let i = 0; i < HEARTS; i++) {
    const x = VW / 2 + (i - 1) * 38, y = 106;
    heart(x, y, 15, i < hearts ? YELLOW : 'rgba(255,255,255,0.35)');
  }
}

function heart(x, y, r, col) {
  push();
  translate(x, y);
  fill(col); stroke(INK); strokeWeight(3); strokeJoin(ROUND);
  beginShape();
  vertex(0, r * 0.95);
  bezierVertex(-r * 1.6, -r * 0.1, -r * 0.7, -r * 1.25, 0, -r * 0.45);
  bezierVertex(r * 0.7, -r * 1.25, r * 1.6, -r * 0.1, 0, r * 0.95);
  endShape(CLOSE);
  pop();
  noStroke();
}

//Bouncing arrow over the dude she'll hit next; it pulses when he's close enough to hit
function drawTargetArrow() {
  const t = target();
  if (!t) return;
  const cx = VW / 2, gap = abs(t.x - cx) - dudeHalf();
  const inReach = gap <= reachOf(player.id, 'kick') + 8;
  const bounce = abs(sin(millis() / (inReach ? 90 : 170))) * 10;
  const r = inReach ? 17 : 13;
  const y = GROUND - DUDE_H - 22 - bounce;
  push();
  translate(constrain(t.x, 24, VW - 24), y);
  fill(inReach ? YELLOW : '#FFFFFF'); stroke(INK); strokeWeight(3); strokeJoin(ROUND);
  triangle(-r, -r * 1.1, r, -r * 1.1, 0, r * 0.6);
  pop();
  noStroke();
}

function drawButtons() {
  for (const b of BTNS) {
    const down = pressedBtn === b.id && millis() - pressedAt < 130;
    const ready = millis() >= player.readyAt;
    const dy = down ? 4 : 0;
    noStroke(); fill(40, 31, 28, 90); rect(b.x - BTN_W / 2 + 4, BTN_Y - BTN_H / 2 + 6, BTN_W, BTN_H, 14);
    fill(down ? lerpColor(color(b.col), color(0), 0.18) : b.col); stroke(INK); strokeWeight(3);
    rect(b.x - BTN_W / 2 + (down ? 2 : 0), BTN_Y - BTN_H / 2 + dy, BTN_W, BTN_H, 14);
    noStroke(); fill(INK); textFont('KCBubbleShack'); textSize(26); textAlign(CENTER, CENTER);
    drawingContext.globalAlpha = ready ? 1 : 0.45;
    text(b.label, b.x + (down ? 2 : 0), BTN_Y + dy);
    drawingContext.globalAlpha = 1;
  }
}

function drawScore() {
  const w = 190, h = w * scorePaper.height / scorePaper.width;
  image(scorePaper, VW / 2 - w / 2, 752, w, h);
  fill(INK); textFont(monoFont); textSize(13); textAlign(CENTER, CENTER);
  text(`KO ${kos}    BEST ${max(best, kos)}`, VW / 2, 752 + h / 2);
}

function drawOver() {
  const h = 190;
  const top = 60;                           //above her head
  image(retryPaper, VW / 2 - 160, top, 320, h);
  styledText(`${kos} DUDE${kos === 1 ? '' : 'S'} KO'D`, VW / 2, top + 52, 28);
  fill(INK); textFont(monoFont); textSize(12); textAlign(CENTER, CENTER);
  text(newBest ? 'NEW BEST' : `BEST ${best}`, VW / 2, top + 92);
  if (millis() - overAt > 900) styledText('TAP TO PLAY AGAIN', VW / 2, top + 140, 17, '#FFFFFF', 1.5);
}

// ---------- Input ----------

function press(px, py) {
  const x = (px - ox) / sc, y = (py - oy) / sc;
  if (state === 'select') {
    pick = x < VW / 2 ? 'olivia' : 'chappell';
    state = 'picked'; pickedAt = millis();
  } else if (state === 'play') {
    for (const b of BTNS) {
      if (abs(x - b.x) < BTN_W / 2 + 6 && abs(y - BTN_Y) < BTN_H / 2 + 10) {
        pressedBtn = b.id; pressedAt = millis();
        attack(b.id);
      }
    }
  } else if (state === 'over' && millis() - overAt > 900) {
    state = 'select';
  }
}

//Touch: only the finger that just went down (others may still be resting on a button)
let lastTouchCount = 0;
function touchStarted() {
  for (let i = lastTouchCount; i < touches.length; i++) press(touches[i].x, touches[i].y);
  lastTouchCount = touches.length;
  return false;
}
function touchEnded() { lastTouchCount = touches.length; return false; }

function mousePressed(e) {
  if (e && e.pointerType === 'touch') return false;   //already handled as a touch
  press(mouseX, mouseY);
  return false;
}

//Keyboard for desktop: Z / J punch, X / K kick, any arrow or space to pick on the select screen
function keyPressed() {
  const k = key.toLowerCase();
  if (state === 'play') {
    if (k === 'z' || k === 'j' || key === ' ') { pressedBtn = 'punch'; pressedAt = millis(); attack('punch'); }
    if (k === 'x' || k === 'k') { pressedBtn = 'kick'; pressedAt = millis(); attack('kick'); }
  } else if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || key === ' ') {
    press(keyCode === RIGHT_ARROW ? width - ox - 10 : ox + 10, height / 2);
  }
}

// ---------- Helpers ----------

function buzz(ms) {
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms);
}

//Best score per character in this browser; the game works fine without it
function loadBest(id) {
  try { return parseInt(localStorage.getItem('expectations-best-' + id)) || 0; } catch (e) { return 0; }
}
function saveBest(id, v) {
  try { localStorage.setItem('expectations-best-' + id, v); } catch (e) {}
}
