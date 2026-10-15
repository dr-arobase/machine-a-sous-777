// ====== Machine à sous — Levier 777 (Améliorée) ======

// --- Éléments DOM ---
const balanceEl     = document.getElementById('balance');
const bestWinEl     = document.getElementById('bestWin');
const gamesPlayedEl = document.getElementById('gamesPlayed');
const betEl         = document.getElementById('bet');
const msgEl         = document.getElementById('message');
const reelEls       = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
const lever         = document.getElementById('lever');
const pullBtn       = document.getElementById('pullBtn');
const resetBtn      = document.getElementById('resetBtn');
const historyEl     = document.getElementById('history');
const jackpotOverlay  = document.getElementById('jackpotOverlay');
const jackpotAmountEl = document.getElementById('jackpotAmount');
const closeOverlay    = document.getElementById('closeOverlay');
const betHalfBtn    = document.getElementById('betHalf');
const betDoubleBtn  = document.getElementById('betDouble');
const betMaxBtn     = document.getElementById('betMax');

// --- Éléments stats live ---
const statGamesEl    = document.getElementById('statGames');
const statWinsEl     = document.getElementById('statWins');
const statLossesEl   = document.getElementById('statLosses');
const statJackpotsEl = document.getElementById('statJackpots');
const statWinRateEl  = document.getElementById('statWinRate');
const statNetEl      = document.getElementById('statNet');
const statTotalBetEl = document.getElementById('statTotalBet');
const statRTPEl      = document.getElementById('statRTP');
const rtpBarFillEl   = document.getElementById('rtpBarFill');
const rtpBarPctEl    = document.getElementById('rtpBarPct');

// --- État ---
let balance     = 1000;
let bestWin     = 0;
let gamesPlayed = 0;
let spinning    = false;
const MAX_HISTORY = 10;

// --- Stats session ---
let sWins     = 0;
let sLosses   = 0;
let sJackpots = 0;
let sTotalBet = 0;
let sTotalWon = 0; // montant reçu (gains bruts)

// --- Symboles rouleau ---
const SYMBOLS = ['0','1','2','3','4','5','6','7','8','9'];

// --- Audio (Web Audio API) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.12, vol = 0.25, delay = 0) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  } catch(e) {}
}

function playSpinSound() {
  // Bruit de rotation
  for (let i = 0; i < 6; i++) {
    playTone(80 + i * 30, 'sawtooth', 0.08, 0.06, i * 0.18);
  }
}

function playStopSound(index) {
  playTone(300 + index * 80, 'square', 0.1, 0.15, 0);
}

function playWinSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => playTone(f, 'sine', 0.18, 0.2, i * 0.12));
}

function playJackpotSound() {
  const melody = [523,659,784,1047,1319,1568,2093];
  melody.forEach((f, i) => {
    playTone(f, 'sine', 0.25, 0.3, i * 0.1);
    playTone(f * 1.5, 'triangle', 0.15, 0.15, i * 0.1 + 0.05);
  });
}

function playLoseSound() {
  playTone(220, 'sawtooth', 0.2, 0.15, 0);
  playTone(180, 'sawtooth', 0.2, 0.12, 0.15);
}

// --- Utilitaires ---
function randSymbol() { return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }

function fmt(n) { return n.toLocaleString('fr-CA'); }

function updateBalance() {
  balanceEl.textContent = fmt(balance);
  animateBump(balanceEl);
}

function updateStats() {
  bestWinEl.textContent     = fmt(bestWin);
  gamesPlayedEl.textContent = fmt(gamesPlayed);
}

function updateLiveStats() {
  statGamesEl.textContent  = fmt(gamesPlayed);
  statWinsEl.textContent   = fmt(sWins);
  statLossesEl.textContent = fmt(sLosses);
  statJackpotsEl.textContent = fmt(sJackpots);

  // Taux de victoire
  if (gamesPlayed > 0) {
    const wr = ((sWins / gamesPlayed) * 100).toFixed(1);
    statWinRateEl.textContent = wr + ' %';
    statWinRateEl.className = 'ls-value' + (sWins > sLosses ? ' green' : ' red');
  } else {
    statWinRateEl.textContent = '—';
    statWinRateEl.className = 'ls-value';
  }

  // Gain / Perte net (par rapport au solde initial de 1000)
  const net = balance - 1000;
  statNetEl.textContent = (net >= 0 ? '+' : '') + fmt(net) + ' cr.';
  statNetEl.className = 'ls-value ' + (net > 0 ? 'green' : net < 0 ? 'red' : '');

  // Mise totale
  statTotalBetEl.textContent = fmt(sTotalBet) + ' cr.';

  // RTP réel
  if (sTotalBet > 0) {
    const rtp = ((sTotalWon / sTotalBet) * 100).toFixed(1);
    statRTPEl.textContent = rtp + ' %';
    rtpBarPctEl.textContent = rtp + ' %';
    const pct = Math.min(parseFloat(rtp), 150);
    rtpBarFillEl.style.width = (pct / 150 * 100) + '%';
    // Couleur de la barre selon RTP vs théorique
    if (pct >= 67.6) {
      rtpBarFillEl.style.background = 'linear-gradient(90deg, #ffaa00, #44ff88)';
    } else {
      rtpBarFillEl.style.background = 'linear-gradient(90deg, #ff4444, #ffaa00)';
    }
  } else {
    statRTPEl.textContent  = '—';
    rtpBarPctEl.textContent = '—';
    rtpBarFillEl.style.width = '0%';
  }

  // Bump sur les éléments qui changent
  [statGamesEl, statWinsEl, statLossesEl, statJackpotsEl, statNetEl, statTotalBetEl, statRTPEl].forEach(animateBump);
}

function animateBump(el) {
  el.classList.remove('bump');
  void el.offsetWidth; // reflow
  el.classList.add('bump');
}

function canPlay(bet) {
  return Number.isFinite(bet) && bet >= 1 && bet <= balance;
}

function setReelContent(el, val) {
  el.innerHTML = `<span>${val}</span>`;
}

// --- Particules flottantes (ambiance) ---
function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const colors = ['#ffd700','#ff6b6b','#39ff14','#00d4ff','#ff2d78'];
    p.style.setProperty('--x',     Math.random() * 100 + '%');
    p.style.setProperty('--dur',   (6 + Math.random() * 8) + 's');
    p.style.setProperty('--delay', (Math.random() * 8) + 's');
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
}

// --- Confettis ---
function launchConfetti(count = 60) {
  const colors = ['#ffd700','#ff6b6b','#39ff14','#00d4ff','#ff2d78','#fff','#ff9900'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.setProperty('--x',     Math.random() * 100 + 'vw');
    c.style.setProperty('--dur',   (2 + Math.random() * 2) + 's');
    c.style.setProperty('--delay', (Math.random() * 1.5) + 's');
    c.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
    c.style.setProperty('--rot',   Math.floor(Math.random() * 360) + 'deg');
    c.style.setProperty('--dx',    (Math.random() * 200 - 100) + 'px');
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

// --- Historique ---
function addHistory(combo, type) {
  const item = document.createElement('div');
  item.className = `history-item h-${type}`;
  item.textContent = combo;
  historyEl.insertBefore(item, historyEl.firstChild);
  // Limiter
  while (historyEl.children.length > MAX_HISTORY) {
    historyEl.removeChild(historyEl.lastChild);
  }
}

// --- Spin principal ---
async function spin(bet) {
  if (spinning) return;
  bet = Math.floor(bet);
  if (!canPlay(bet)) {
    msgEl.textContent = '⚠️ Mise invalide ou solde insuffisant.';
    msgEl.className   = 'message lose';
    return;
  }

  spinning = true;
  pullBtn.disabled = true;
  betEl.disabled   = true;
  resetBtn.classList.add('hidden');
  msgEl.textContent = '🎰 Les rouleaux tournent...';
  msgEl.className   = 'message';

  // Déduire la mise
  balance -= bet;
  gamesPlayed++;
  sTotalBet += bet;
  updateBalance();
  updateStats();

  // Sons de rotation
  playSpinSound();

  // Démarrer l'animation de tous les rouleaux
  reelEls.forEach(r => {
    r.classList.remove('win-flash','jackpot-flash');
    r.classList.add('spin');
  });

  // Résultats
  const results = [0, 0, 0];
  const delays  = [1200, 1800, 2400];

  for (let i = 0; i < reelEls.length; i++) {
    // Clignotement rapide
    await new Promise(resolve => {
      const t = setInterval(() => {
        setReelContent(reelEls[i], randSymbol());
      }, 70);
      setTimeout(() => {
        clearInterval(t);
        results[i] = randSymbol();
        setReelContent(reelEls[i], results[i]);
        reelEls[i].classList.remove('spin');
        playStopSound(i);
        resolve();
      }, delays[i]);
    });
  }

  // --- Calcul du gain ---
  const [a, b, c] = results;
  let win = 0;
  let outcomeText = '';
  let msgClass = 'message';
  let histClass = 'h-lose';

  if (a === '7' && b === '7' && c === '7') {
    win = bet * 100;
    outcomeText = `🎰 JACKPOT 777 !  +${fmt(win)} crédits`;
    msgClass    = 'message jackpot';
    histClass   = 'h-jackpot';
    reelEls.forEach(r => r.classList.add('jackpot-flash'));
    playJackpotSound();
    launchConfetti(80);
    sWins++;
    sJackpots++;
    // Afficher overlay jackpot
    jackpotAmountEl.textContent = `+${fmt(win)} crédits`;
    jackpotOverlay.classList.remove('hidden');
  } else if (a === b && b === c) {
    win = bet * 10;
    outcomeText = `🥳 3 identiques [${a}${b}${c}] !  +${fmt(win)} crédits`;
    msgClass    = 'message win';
    histClass   = 'h-triple';
    reelEls.forEach(r => r.classList.add('win-flash'));
    playWinSound();
    launchConfetti(30);
    sWins++;
  } else if (a === b || a === c || b === c) {
    win = bet * 2;
    outcomeText = `👍 2 identiques [${a}${b}${c}] !  +${fmt(win)} crédits`;
    msgClass    = 'message doublewin';
    histClass   = 'h-double';
    playWinSound();
    sWins++;
  } else {
    outcomeText = `😞 Perdu  [${a}${b}${c}]  −${fmt(bet)} crédits`;
    msgClass    = 'message lose';
    playLoseSound();
    sLosses++;
  }

  balance += win;
  sTotalWon += win;
  if (win > bestWin) bestWin = win;
  updateBalance();
  updateStats();
  updateLiveStats();

  msgEl.textContent = outcomeText;
  msgEl.className   = msgClass;
  addHistory(`${a} ${b} ${c}`, histClass.replace('h-', ''));

  // Réactiver
  spinning = false;
  if (balance <= 0) {
    pullBtn.disabled = true;
    resetBtn.classList.remove('hidden');
    msgEl.textContent += ' — Solde épuisé !';
  } else {
    pullBtn.disabled = false;
  }
  betEl.disabled = false;
}

// --- Contrôles de mise ---
betHalfBtn.addEventListener('click', () => {
  const v = Math.max(1, Math.floor(Number(betEl.value) / 2));
  betEl.value = v;
});
betDoubleBtn.addEventListener('click', () => {
  const v = Math.min(balance, Math.floor(Number(betEl.value) * 2));
  betEl.value = v;
});
betMaxBtn.addEventListener('click', () => {
  betEl.value = balance;
});

// --- Levier ---
lever.addEventListener('click', () => {
  if (spinning) return;
  lever.classList.remove('pulled');
  void lever.offsetWidth;
  lever.classList.add('pulled');
  spin(Number(betEl.value));
});

// --- Bouton Tirer ---
pullBtn.addEventListener('click', () => lever.click());

// --- Reset ---
resetBtn.addEventListener('click', () => {
  balance = 1000;
  gamesPlayed = 0;
  bestWin = 0;
  sWins = 0;
  sLosses = 0;
  sJackpots = 0;
  sTotalBet = 0;
  sTotalWon = 0;
  updateBalance();
  updateStats();
  updateLiveStats();
  resetBtn.classList.add('hidden');
  pullBtn.disabled = false;
  msgEl.textContent = '🔄 Solde rechargé ! Bonne chance !';
  msgEl.className   = 'message';
  reelEls.forEach(r => {
    r.classList.remove('win-flash','jackpot-flash');
    setReelContent(r, '🎰');
  });
  historyEl.innerHTML = '';
});

// --- Fermer overlay jackpot ---
closeOverlay.addEventListener('click', () => {
  jackpotOverlay.classList.add('hidden');
});

// --- Clavier ---
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !spinning) {
    e.preventDefault();
    lever.click();
  }
});

// --- Init ---
initParticles();
updateBalance();
updateStats();
updateLiveStats();
reelEls.forEach(r => setReelContent(r, '🎰'));

