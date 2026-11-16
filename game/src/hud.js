// NIGHTHAUL — the DOM HUD: health, armour, ammo, money, clock, score, killfeed,
// prompts, channel/upload bars, buy menu, minimap, banner and scoreboard.
// Presentation only: it reads state, never writes it (except buy clicks, which
// go through rounds.buyItem).

import { BUY_MENU, TIMING, WEAPONS } from './config.js';
import { COLLIDERS, PYLONS } from './mapdata.js';
import { buyItem } from './rounds.js';
import { currentSpread } from './weapons.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  const hud = {
    health: el('health-num'), healthBar: el('health-bar'),
    armor: el('armor-num'), ammoMag: el('ammo-mag'), ammoRes: el('ammo-reserve'),
    weaponName: el('weapon-name'), grenades: el('grenades'),
    money: el('money'), timer: el('timer'), roundLabel: el('round-label'),
    scoreR: el('score-r'), scoreA: el('score-a'),
    killfeed: el('killfeed'), prompt: el('prompt'),
    channelWrap: el('channel-wrap'), channelLabel: el('channel-label'), channelBar: el('channel-bar'),
    uploadWrap: el('upload-wrap'), uploadBar: el('upload-bar'),
    buy: el('buy'), buyItems: el('buy-items'), buyMoney: el('buy-money'),
    minimap: el('minimap'), banner: el('banner'), bannerTitle: el('banner-title'), bannerSub: el('banner-sub'),
    scoreboard: el('scoreboard'), scoreRows: el('score-rows'), roundLog: el('round-log'),
    crosshair: el('crosshair'), hitmarker: el('hitmarker'), damage: el('damage'),
    scope: el('scope'), coreStatus: el('core-status'),
    lastKillfeed: -1, buyOpen: false, buyBuilt: false,
  };
  const mm = hud.minimap;
  if (mm) { mm.width = 176; mm.height = 132; }
  return hud;
}

function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

function buildBuy(hud, state) {
  const player = state.fighters[0];
  hud.buyItems.innerHTML = '';
  for (const item of BUY_MENU) {
    const row = document.createElement('div');
    row.className = 'buy-row' + (player.money < item.price ? ' poor' : '');
    row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.label}</span><span class="buy-price">${fmtMoney(item.price)}</span>`;
    row.addEventListener('click', () => { buyItem(state, player, item.id); refreshBuy(hud, state); });
    hud.buyItems.appendChild(row);
  }
  hud.buyBuilt = true;
}

function refreshBuy(hud, state) {
  const player = state.fighters[0];
  hud.buyMoney.textContent = fmtMoney(player.money);
  const rows = hud.buyItems.children;
  for (let i = 0; i < rows.length; i++) {
    rows[i].classList.toggle('poor', player.money < BUY_MENU[i].price);
    rows[i].classList.toggle('owned', BUY_MENU[i].kind === 'weapon' && player.primary === BUY_MENU[i].id);
  }
}

function drawMinimap(hud, state) {
  const c = hud.minimap;
  if (!c) return;
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const sx = (x) => (x + 32) / 64 * W;
  const sz = (z) => (z + 24) / 48 * H;
  g.fillStyle = 'rgba(10,20,32,0.85)';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2e3841';
  for (const col of COLLIDERS) {
    if (col.kind === 'edge') continue;
    g.fillRect(sx(col.x0), sz(col.z0), Math.max(1, sx(col.x1) - sx(col.x0)), Math.max(1, sz(col.z1) - sz(col.z0)));
  }
  // Water edge.
  g.fillStyle = '#0a2a3a';
  g.fillRect(0, sz(21.4), W, H - sz(21.4));
  // Pylons.
  for (const [key, p] of Object.entries(PYLONS)) {
    const active = state.upload.site === key && state.upload.state !== 'idle';
    g.fillStyle = active ? '#2fd6c0' : '#8b98a3';
    g.beginPath(); g.arc(sx(p.x), sz(p.z), active ? 6 : 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8ecef'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
    g.fillText(key, sx(p.x), sz(p.z) - 7);
  }
  // The core: teal diamond where it lies (or on its carrier).
  if (state.core.state !== 'carried') {
    g.fillStyle = '#2fd6c0';
    g.beginPath();
    g.moveTo(sx(state.core.pos.x), sz(state.core.pos.z) - 5);
    g.lineTo(sx(state.core.pos.x) + 5, sz(state.core.pos.z));
    g.lineTo(sx(state.core.pos.x), sz(state.core.pos.z) + 5);
    g.lineTo(sx(state.core.pos.x) - 5, sz(state.core.pos.z));
    g.closePath(); g.fill();
  }
  // Fighters: teammates teal, revealed enemies orange, the player white.
  for (const f of state.fighters) {
    if (!f.alive) continue;
    if (f.isPlayer) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(sx(f.pos.x), sz(f.pos.z), 3.5, 0, Math.PI * 2); g.fill();
    } else if (f.team === 'R') {
      g.fillStyle = '#2fd6c0';
      g.beginPath(); g.arc(sx(f.pos.x), sz(f.pos.z), 2.5, 0, Math.PI * 2); g.fill();
    } else if (f.revealedT > 0) {
      g.fillStyle = '#ff9a2e';
      g.beginPath(); g.arc(sx(f.pos.x), sz(f.pos.z), 3, 0, Math.PI * 2); g.fill();
    }
  }
}

export function updateHud(hud, state, fx, input, dt) {
  const p = state.fighters[0];
  // Vitals.
  hud.health.textContent = Math.max(0, Math.ceil(p.hp));
  hud.healthBar.style.width = Math.max(0, p.hp) + '%';
  hud.healthBar.style.background = p.hp > 50 ? '#2fd6c0' : p.hp > 25 ? '#ff9a2e' : '#e5484d';
  hud.armor.textContent = p.armor > 0 ? 'ARMOUR' : '—';
  hud.ammoMag.textContent = p.weapon.mag;
  hud.ammoRes.textContent = '/ ' + p.weapon.reserve;
  hud.weaponName.textContent = WEAPONS[p.weapon.id].name;
  hud.grenades.textContent = `Frag ${p.grenades.frag} · Pulse ${p.grenades.pulse} (G)`;
  hud.money.textContent = fmtMoney(p.money);
  const t = Math.max(0, Math.ceil(state.timer));
  hud.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  hud.timer.style.color = t <= 15 && state.phase === 'live' ? '#e5484d' : '';
  hud.roundLabel.textContent = `ROUND ${state.round}`;
  hud.scoreR.textContent = state.score.R;
  hud.scoreA.textContent = state.score.A;
  // Core status line.
  let coreText = 'CORE: at Runner spawn';
  if (state.core.state === 'carried') {
    const holder = state.fighters[state.core.holderId];
    coreText = `CORE: ${holder ? holder.name : '?'} carrying`;
  } else if (state.core.state === 'dropped') coreText = 'CORE: DROPPED on the dock';
  if (state.upload.state === 'uploading') coreText = `UPLOAD ${Math.floor(state.upload.progress)}s / ${TIMING.uploadSeconds}s — Site ${state.upload.site}`;
  else if (state.upload.state === 'channel') coreText = `CHANNELING Site ${state.upload.site}…`;
  hud.coreStatus.textContent = coreText;
  // Crosshair gap follows the live spread; scoped hides it.
  const scoped = input.scoped && p.weapon.id === 'sniper';
  hud.scope.hidden = !scoped;
  hud.crosshair.style.display = scoped ? 'none' : 'block';
  const gap = Math.round(4 + currentSpread(p) * 900);
  hud.crosshair.style.setProperty('--gap', gap + 'px');
  hud.hitmarker.classList.toggle('on', fx.hitmarkT > 0);
  hud.hitmarker.classList.toggle('head', fx.hitmarkHead);
  hud.damage.style.opacity = fx.damageT > 0 ? Math.min(1, fx.damageT) : 0;
  hud.damage.style.transform = `translate(-50%,-50%) rotate(${fx.damageAngle}rad)`;
  // Killfeed.
  if (state.killfeed.length !== hud.lastKillfeed) {
    hud.lastKillfeed = state.killfeed.length;
    hud.killfeed.innerHTML = state.killfeed.map((k) => `<div class="kf ${k.cls}">${k.text}</div>`).join('');
  }
  // Prompt line.
  let prompt = '';
  if (state.phase === 'buy') prompt = 'Buy phase — press B for the buy menu, 1–7 to buy';
  else if (state.phase === 'live' && p.alive) {
    if (state.upload.state === 'uploading') {
      prompt = `Upload running at Site ${state.upload.site} — defend the pylon`;
    } else if (state.core.state !== 'carried' && Math.hypot(p.pos.x - state.core.pos.x, p.pos.z - state.core.pos.z) < 2.5) {
      prompt = 'DATA CORE HERE — walk over it to pick it up';
    } else if (p.carryingCore) {
      const near = Object.entries(PYLONS).find(([, q]) => Math.hypot(p.pos.x - q.x, p.pos.z - q.z) < 3.5);
      prompt = near ? 'HOLD E — channel the upload (4 s)' : 'Carry the core to Pylon A (Crane Row) or B (Dockside)';
    }
  }
  hud.prompt.textContent = prompt;
  // Channel bar (the player's own channel) and upload bar.
  if (p.channelT > 0 && p.channelKind) {
    hud.channelWrap.hidden = false;
    const total = p.channelKind === 'upload' ? TIMING.channelSeconds : p.channelKind === 'scrub' ? TIMING.scrubSeconds : TIMING.returnSeconds;
    hud.channelLabel.textContent = p.channelKind === 'upload' ? 'CHANNELING UPLOAD…' : p.channelKind === 'scrub' ? 'SCRUBBING UPLOAD…' : 'RETURNING CORE…';
    hud.channelBar.style.width = Math.min(100, (p.channelT / total) * 100) + '%';
  } else hud.channelWrap.hidden = true;
  if (state.upload.state === 'uploading') {
    hud.uploadWrap.hidden = false;
    hud.uploadBar.style.width = (state.upload.progress / TIMING.uploadSeconds) * 100 + '%';
  } else hud.uploadWrap.hidden = true;
  // Buy menu: open through the buy phase; B toggles it (main.js flips buyOpen).
  if (state.phase === 'buy') hud.buyOpen = true;
  hud.buy.hidden = !hud.buyOpen;
  if (hud.buyOpen && !hud.buyBuilt) buildBuy(hud, state);
  if (hud.buyOpen) refreshBuy(hud, state);
  // Banner (round / upload / match notices, 3 s).
  if (state.banner && state.time - state.banner.t < 3) {
    hud.banner.hidden = false;
    hud.bannerTitle.textContent = state.banner.title;
    hud.bannerSub.textContent = state.banner.sub;
  } else hud.banner.hidden = true;
  // Scoreboard.
  hud.scoreboard.hidden = !input.scoreHeld;
  if (input.scoreHeld) {
    hud.scoreRows.innerHTML = state.fighters.map((f) => (
      `<div class="sr ${f.team === 'R' ? 'r' : 'a'}"><span>${f.name}${f.isPlayer ? ' (you)' : ''}</span><span>${f.kills} K</span><span>${f.deaths} D</span><span>${fmtMoney(f.money)}</span></div>`
    )).join('');
    hud.roundLog.innerHTML = state.roundLog.slice(0, 6).map((l) => `<div>${l}</div>`).join('');
  }
  drawMinimap(hud, state);
}
