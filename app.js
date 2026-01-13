// Prompemaskin Remote
// - Host (controller) gets a 4-digit code (PeerJS ID)
// - Join connects to that code
// - Host sends "soundId" to Join, Join plays sound

const $ = (id) => document.getElementById(id);

// Screens
const screenRole = $("screenRole");
const screenHost = $("screenHost");
const screenJoin = $("screenJoin");

// Buttons
const btnHost = $("btnHost");
const btnJoin = $("btnJoin");
const btnBackFromHost = $("btnBackFromHost");
const btnBackFromJoin = $("btnBackFromJoin");
const btnNewCode = $("btnNewCode");
const btnConnect = $("btnConnect");
const btnEnableAudio = $("btnEnableAudio");
const btnTestPing = $("btnTestPing");
const chkHaptics = $("chkHaptics");

// UI
const hostCodeEl = $("hostCode");
const joinCodeEl = $("joinCode");
const statusDot = $("statusDot");
const statusText = $("statusText");
const logHost = $("logHost");
const logJoin = $("logJoin");
const nowPlaying = $("nowPlaying");
const hostButtonsWrap = $("hostButtons");

// PeerJS objects
let peer = null;
let conn = null;
let role = null; // "host" | "join"

// Audio
let audioUnlocked = false;

// 6 forskellige prompelyder (kan byttes til dine egne URLs)
const SOUNDS = [
  {
    id: "s1",
    name: "Mini Snik",
    emoji: "🤫",
    url: "https://cdn.jsdelivr.net/gh/SlimThickens/Fart-sounds@main/fart-8-228244.mp3"
  },
  {
    id: "s2",
    name: "Tørr Knek",
    emoji: "🪵",
    url: "https://cdn.jsdelivr.net/gh/SlimThickens/Fart-sounds@main/fart-9-228245.mp3"
  },
  {
    id: "s3",
    name: "Stolt Brak",
    emoji: "🦚",
    url: "https://cdn.jsdelivr.net/gh/SlimThickens/Fart-sounds@main/proud-fart-288263.mp3"
  },
  {
    id: "s4",
    name: "Kanon",
    emoji: "💥",
    url: "https://cdn.jsdelivr.net/npm/fartify@1.0.1/fart.mp3"
  },
  // Bonus-URLer: behold gjerne disse som placeholders eller bytt til egne.
  // (Hvis en av disse ikke spiller i din nettleser, bytt den ut med en annen mp3.)
  {
    id: "s5",
    name: "Bølge",
    emoji: "🌊",
    url: "https://cdn.jsdelivr.net/gh/SlimThickens/Fart-sounds@main/fart-9-228245.mp3"
  },
  {
    id: "s6",
    name: "Boss",
    emoji: "👑",
    url: "https://cdn.jsdelivr.net/gh/SlimThickens/Fart-sounds@main/fart-8-228244.mp3"
  }
];

// Preload Audio elements on Join side
const audioMap = new Map();
function prepareAudio() {
  SOUNDS.forEach(s => {
    const a = new Audio(s.url);
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = 1.0;
    audioMap.set(s.id, a);
  });
}

function log(el, msg) {
  const ts = new Date().toLocaleTimeString();
  el.textContent = `[${ts}] ${msg}\n` + el.textContent;
}

function setStatus(connected, text) {
  statusDot.classList.toggle("on", connected);
  statusText.textContent = text;
}

function showScreen(which) {
  screenRole.classList.add("hidden");
  screenHost.classList.add("hidden");
  screenJoin.classList.add("hidden");
  which.classList.remove("hidden");
}

function cleanupPeer() {
  try { conn?.close(); } catch {}
  try { peer?.destroy(); } catch {}
  conn = null;
  peer = null;
  role = null;
  setStatus(false, "Ikke tilkoblet");
}

// ---------- ROLE FLOW ----------
btnHost.addEventListener("click", () => startHost());
btnJoin.addEventListener("click", () => startJoin());

btnBackFromHost.addEventListener("click", () => {
  cleanupPeer();
  showScreen(screenRole);
});

btnBackFromJoin.addEventListener("click", () => {
  cleanupPeer();
  showScreen(screenRole);
});

btnNewCode.addEventListener("click", () => {
  if (role === "host") regenerateHostCode();
});

btnConnect.addEventListener("click", () => {
  if (role === "join") connectToHost();
});

btnEnableAudio.addEventListener("click", async () => {
  await unlockAudio();
});

btnTestPing.addEventListener("click", () => {
  if (!conn || conn.open !== true) return log(logHost, "Ikke tilkoblet enda.");
  conn.send({ type: "ping" });
  if (chkHaptics.checked && navigator.vibrate) navigator.vibrate(12);
  log(logHost, "Sendte pling.");
});

// ---------- HOST ----------
function startHost() {
  role = "host";
  showScreen(screenHost);
  setStatus(false, "Host: oppretter kode…");
  logHost.textContent = "";
  renderHostButtons(false);
  regenerateHostCode();
}

function regenerateHostCode() {
  // Destroy existing peer first
  try { peer?.destroy(); } catch {}
  peer = null;

  const code = random4Digit();
  hostCodeEl.textContent = code;

  setStatus(false, `Host-kode: ${code}`);
  log(logHost, `Prøver kode ${code}…`);

  // Create peer with ID=code (4 digits). If taken, retry.
  peer = new Peer(code, {
    // Uses PeerJS default cloud broker (no setup). Good for demos.
    // For production, you’d run your own PeerServer.
    debug: 1
  });

  peer.on("open", (id) => {
    setStatus(false, `Host klar • Kode: ${id}`);
    log(logHost, `Klar. Vent på Join…`);
  });

  peer.on("connection", (c) => {
    conn = c;
    setupConnHandlers("host");
    setStatus(true, `Tilkoblet • Join er inne`);
    log(logHost, "Join koblet til ✅");
    renderHostButtons(true);
  });

  peer.on("error", (err) => {
    // If ID already taken, pick a new one
    if (String(err?.type) === "unavailable-id") {
      log(logHost, `Kode ${code} var opptatt. Lager ny…`);
      regenerateHostCode();
    } else {
      log(logHost, `Peer-feil: ${err?.type || err}`);
      setStatus(false, "Feil (prøv ny kode)");
    }
  });
}

function renderHostButtons(enabled) {
  hostButtonsWrap.innerHTML = "";
  SOUNDS.forEach((s, idx) => {
    const btn = document.createElement("button");
    btn.className = "fartBtn";
    btn.disabled = !enabled;
    btn.innerHTML = `
      <span class="emoji">${s.emoji}</span>
      ${s.name}
      <span class="tag">#${idx + 1}</span>
    `;
    btn.addEventListener("click", () => {
      if (!conn || conn.open !== true) {
        log(logHost, "Ingen Join tilkoblet.");
        return;
      }
      conn.send({ type: "play", soundId: s.id, name: s.name });
      if (chkHaptics.checked && navigator.vibrate) navigator.vibrate([10, 30, 10]);
      log(logHost, `Trigger: ${s.name}`);
    });
    hostButtonsWrap.appendChild(btn);
  });
}

// ---------- JOIN ----------
function startJoin() {
  role = "join";
  showScreen(screenJoin);
  setStatus(false, "Join: klar");
  logJoin.textContent = "";
  nowPlaying.textContent = "Venter…";

  // Prepare audio elements
  prepareAudio();
}

async function unlockAudio() {
  // Must be called from a user gesture
  try {
    // Play & pause a tiny bit from first sound (muted)
    const first = audioMap.get(SOUNDS[0].id);
    first.volume = 0.0001;
    await first.play();
    first.pause();
    first.currentTime = 0;
    first.volume = 1.0;

    audioUnlocked = true;
    log(logJoin, "Lyd aktivert ✅");
    nowPlaying.textContent = "Lyd aktivert ✅";
  } catch (e) {
    log(logJoin, "Kunne ikke aktivere lyd. Prøv igjen (noen mobiler krever to trykk).");
  }
}

function connectToHost() {
  const code = (joinCodeEl.value || "").trim();
  if (!/^\d{4}$/.test(code)) {
    log(logJoin, "Skriv inn en gyldig 4-sifret kode.");
    return;
  }

  // Create peer with random ID (auto)
  try { peer?.destroy(); } catch {}
  peer = new Peer(undefined, { debug: 1 });

  peer.on("open", () => {
    setStatus(false, `Kobler til ${code}…`);
    log(logJoin, `Kobler til host ${code}…`);

    conn = peer.connect(code, { reliable: true });
    setupConnHandlers("join");
  });

  peer.on("error", (err) => {
    log(logJoin, `Peer-feil: ${err?.type || err}`);
    setStatus(false, "Feil ved oppkobling");
  });
}

// ---------- CONNECTION HANDLERS ----------
function setupConnHandlers(side) {
  if (!conn) return;

  conn.on("open", () => {
    if (side === "join") {
      setStatus(true, "Tilkoblet • Klar til å spille");
      log(logJoin, "Tilkoblet ✅");
    }
  });

  conn.on("data", async (data) => {
    if (!data || typeof data !== "object") return;

    if (data.type === "ping") {
      if (side === "join") {
        if (navigator.vibrate) navigator.vibrate(20);
        log(logJoin, "Pling mottatt 🔔");
        nowPlaying.textContent = "🔔 Pling";
      }
      return;
    }

    if (data.type === "play" && side === "join") {
      const { soundId, name } = data;

      if (!audioUnlocked) {
        log(logJoin, `Mottok "${name}", men lyd er ikke aktivert. Trykk “Aktiver lyd”.`);
        nowPlaying.textContent = `Mottok ${name} (trykk Aktiver lyd)`;
        return;
      }

      await playSound(soundId, name);
    }
  });

  conn.on("close", () => {
    setStatus(false, "Tilkobling lukket");
    if (side === "host") {
      log(logHost, "Join koblet fra.");
      renderHostButtons(false);
    } else {
      log(logJoin, "Koblet fra host.");
      nowPlaying.textContent = "Venter…";
    }
  });

  conn.on("error", (err) => {
    if (side === "host") log(logHost, `Conn-feil: ${err?.type || err}`);
    else log(logJoin, `Conn-feil: ${err?.type || err}`);
  });
}

async function playSound(soundId, name) {
  const a = audioMap.get(soundId);
  if (!a) {
    log(logJoin, `Ukjent lyd: ${soundId}`);
    return;
  }

  try {
    a.pause();
    a.currentTime = 0;
    a.volume = 1.0;

    await a.play();
    if (navigator.vibrate) navigator.vibrate([30, 40, 20]);
    nowPlaying.textContent = `💨 Spiller: ${name}`;
    log(logJoin, `Spiller: ${name}`);
  } catch (e) {
    log(logJoin, `Kunne ikke spille lyd (${name}). Bytt URL eller trykk Aktiver lyd igjen.`);
  }
}

function random4Digit() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return String(n);
}

// init
showScreen(screenRole);
setStatus(false, "Ikke tilkoblet");
renderHostButtons(false);

// --- Service Worker (PWA) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      // optional: console.log("SW registered");
    } catch (e) {
      // optional: console.warn("SW registration failed", e);
    }
  });
}
