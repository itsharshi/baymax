const baymaxEl = document.getElementById('baymax');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const rightArm = document.querySelector('.right.arm');
const leftEyeEl = document.querySelector('.left.eye');
const rightEyeEl = document.querySelector('.right.eye');
const headEl = document.querySelector('.head');
const bellyEl = document.querySelector('.belly');
const chestEl = document.querySelector('.chest');

let blinkTimer = null;
let cursorPollTimer = null;
let isSleeping = false;
let speechTimeout = null;
let currentAudio = null;
let idleTimer = null;
let moodCooldown = false;

const VOICE_CLIPS = [
  { file: '../assets/sounds/hello.mp3', text: 'Hello. I am Baymax, your personal healthcare companion.' },
  { file: '../assets/sounds/balalala.mp3', text: 'Ba la la la la.' },
  { file: '../assets/sounds/rate-pain.mp3', text: 'On a scale of 1 to 10, how would you rate your pain?' },
  { file: '../assets/sounds/satisfied.mp3', text: 'Are you satisfied with your care?' },
  { file: '../assets/sounds/not-fast.mp3', text: 'I am not fast.' },
  { file: '../assets/sounds/oh-no.mp3', text: 'Oh no.' },
  { file: '../assets/sounds/fist-bump.mp3', text: 'Fist bump! Ba la la la la.' },
  { file: '../assets/sounds/lollipop.mp3', text: 'You have been a good boy. Have a lollipop.' },
  { file: '../assets/sounds/hairy-baby.mp3', text: 'Hairy baby! Hairy baby!' },
  { file: '../assets/sounds/low-battery.mp3', text: 'I am... low on battery...' },
];

const HEALTH_TIPS = [
  "Remember to stay hydrated. Drink water regularly.",
  "Prolonged screen time can cause eye strain. Look at something 20 feet away for 20 seconds.",
  "Good posture reduces back pain. Please sit up straight.",
  "Deep breathing reduces stress. Inhale for 4 seconds, hold for 4, exhale for 4.",
  "Regular stretching improves circulation. Try stretching your arms above your head.",
  "A short walk can boost your mood and energy levels.",
  "Getting 7 to 8 hours of sleep is recommended for optimal health.",
  "Eating fruits and vegetables provides essential vitamins.",
  "Smiling releases endorphins. I suggest you try smiling now.",
  "It is important to take breaks. Your body needs rest."
];

const PET_REACTIONS = [
  "That tickles!",
  "He he he he.",
  "Ba la la la la.",
  "I enjoy hugs.",
  "There, there.",
  "You are warm.",
];

const IDLE_LINES = [
  "You have been staring at the screen for a while. Please blink.",
  "I detect elevated stress levels. Would you like a hug?",
  "Perhaps a break would be beneficial.",
  "I am still here. I will always be here.",
];

// ── Audio Playback ──

function playClip(clip) {
  stopAudio();
  showSpeechBubble(clip.text);

  currentAudio = new Audio(clip.file);
  currentAudio.volume = 0.9;
  currentAudio.onended = () => {
    speechTimeout = setTimeout(hideSpeechBubble, 2000);
    currentAudio = null;
  };
  currentAudio.onerror = () => {
    speakTTS(clip.text);
    currentAudio = null;
  };
  currentAudio.play().catch(() => speakTTS(clip.text));
}

function playRandomClip() {
  const clip = VOICE_CLIPS[Math.floor(Math.random() * VOICE_CLIPS.length)];
  playClip(clip);
}

function playGreeting() {
  playClip(VOICE_CLIPS[0]);
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  speechSynthesis.cancel();
}

// ── TTS Fallback ──

let selectedVoice = null;

function findBestVoice() {
  const voices = speechSynthesis.getVoices();
  const preferred = [
    'Microsoft David Desktop',
    'Microsoft Mark Online',
    'Microsoft David',
    'Google US English',
    'Alex'
  ];
  for (const name of preferred) {
    const match = voices.find(v => v.name.includes(name));
    if (match) return match;
  }
  return voices.find(v => v.lang.startsWith('en')) || voices[0];
}

function speakTTS(text) {
  speechSynthesis.cancel();
  if (!selectedVoice) selectedVoice = findBestVoice();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.78;
  utterance.pitch = 0.35;
  utterance.volume = 0.85;
  if (selectedVoice) utterance.voice = selectedVoice;

  showSpeechBubble(text);

  utterance.onend = () => {
    speechTimeout = setTimeout(hideSpeechBubble, 2000);
  };
  utterance.onerror = () => {
    speechTimeout = setTimeout(hideSpeechBubble, 3000);
  };

  speechSynthesis.speak(utterance);
}

function showSpeechBubble(text) {
  if (speechTimeout) clearTimeout(speechTimeout);
  speechText.textContent = text;
  speechBubble.classList.remove('hidden');
}

function hideSpeechBubble() {
  speechBubble.classList.add('hidden');
}

// ── Eye Tracking ──

let isDragging = false;

function updateEyes(clientX, clientY) {
  if (!leftEyeEl || !rightEyeEl) return;
  if (!headEl) return;

  const headRect = headEl.getBoundingClientRect();
  const headCenterX = headRect.left + headRect.width / 2;
  const headCenterY = headRect.top + headRect.height / 2;

  const dx = clientX - headCenterX;
  const dy = clientY - headCenterY;
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxOffset = 2.5;
  const factor = Math.min(dist / 200, 1);
  const ox = Math.cos(angle) * maxOffset * factor;
  const oy = Math.sin(angle) * maxOffset * factor;

  leftEyeEl.style.transform = `translate(${ox}px, ${oy}px)`;
  rightEyeEl.style.transform = `translate(${ox}px, ${oy}px)`;
}

document.addEventListener('mousemove', (e) => {
  if (!isSleeping && !isDragging) updateEyes(e.clientX, e.clientY);
  resetIdleTimer();
});

function startCursorPolling() {
  cursorPollTimer = setInterval(async () => {
    if (isSleeping) return;
    try {
      const pos = await window.baymax.getCursorPos();
      if (!isDragging) updateEyes(pos.x, pos.y);
    } catch (e) {}
  }, 120);
}

// ── Blinking ──

function triggerBlink() {
  const eyes = document.querySelectorAll('.eye');
  eyes.forEach(eye => {
    eye.classList.add('blink');
    eye.addEventListener('animationend', () => eye.classList.remove('blink'), { once: true });
  });
}

function scheduleBlink() {
  const delay = 2500 + Math.random() * 4000;
  blinkTimer = setTimeout(() => {
    triggerBlink();
    if (Math.random() < 0.25) {
      setTimeout(triggerBlink, 350);
    }
    scheduleBlink();
  }, delay);
}

function stopBlink() {
  if (blinkTimer) {
    clearTimeout(blinkTimer);
    blinkTimer = null;
  }
}

// ── Wave ──

function wave() {
  if (!rightArm) return;
  rightArm.classList.add('waving');
  rightArm.addEventListener('animationend', () => {
    rightArm.classList.remove('waving');
  }, { once: true });
}

// ══════════════════════════════════
//  DRAG TO REPOSITION
// ══════════════════════════════════

let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;

baymaxEl.addEventListener('mousedown', (e) => {
  if (isSleeping || e.button !== 0) return;
  isDragging = true;
  dragMoved = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  baymaxEl.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    dragMoved = true;
    window.baymax.moveWindow(dx, dy);
    dragStartX = e.screenX;
    dragStartY = e.screenY;
  }
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  baymaxEl.classList.remove('dragging');
  if (dragMoved) {
    triggerWobble();
  }
});

function triggerWobble() {
  baymaxEl.classList.add('wobble');
  baymaxEl.addEventListener('animationend', function handler(e) {
    if (e.animationName === 'wobble') {
      baymaxEl.classList.remove('wobble');
      baymaxEl.removeEventListener('animationend', handler);
    }
  });
}

// ══════════════════════════════════
//  SIT ON TASKBAR
// ══════════════════════════════════

async function sitOnTaskbar() {
  await window.baymax.sitOnTaskbar();
  triggerWobble();
  speakTTS("I will sit here now.");
}

// ══════════════════════════════════
//  MOOD REACTIONS
// ══════════════════════════════════

function setMood(mood, duration) {
  if (moodCooldown) return;
  moodCooldown = true;

  const eyes = document.querySelectorAll('.eye');

  if (mood === 'tilt') {
    baymaxEl.classList.add('tilting');
    setTimeout(() => {
      baymaxEl.classList.remove('tilting');
      moodCooldown = false;
    }, duration || 2000);
  }

  if (mood === 'surprised') {
    eyes.forEach(eye => {
      eye.classList.add('surprised');
      eye.addEventListener('animationend', () => eye.classList.remove('surprised'), { once: true });
    });
    setTimeout(() => { moodCooldown = false; }, duration || 1500);
  }

  if (mood === 'sad') {
    eyes.forEach(eye => {
      eye.classList.add('sad');
      eye.addEventListener('animationend', () => eye.classList.remove('sad'), { once: true });
    });
    setTimeout(() => { moodCooldown = false; }, duration || 3000);
  }

  if (mood === 'happy') {
    eyes.forEach(eye => {
      eye.classList.add('happy');
      eye.addEventListener('animationend', () => eye.classList.remove('happy'), { once: true });
    });
    setTimeout(() => { moodCooldown = false; }, duration || 2000);
  }
}

function randomMoodReaction() {
  const moods = ['tilt', 'surprised', 'happy'];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  setMood(mood);
}

// ══════════════════════════════════
//  PET INTERACTION (belly rub)
// ══════════════════════════════════

let petCount = 0;
let petTimer = null;
let lastPetTime = 0;

function handleBellyPet() {
  const now = Date.now();
  if (now - lastPetTime < 150) return;
  lastPetTime = now;

  petCount++;
  baymaxEl.classList.remove('being-pet');
  void baymaxEl.offsetWidth;
  baymaxEl.classList.add('being-pet');

  if (petTimer) clearTimeout(petTimer);
  petTimer = setTimeout(() => {
    baymaxEl.classList.remove('being-pet');
    if (petCount >= 5) {
      baymaxEl.classList.add('giggling');
      setMood('happy');
      const reaction = PET_REACTIONS[Math.floor(Math.random() * PET_REACTIONS.length)];
      speakTTS(reaction);
      baymaxEl.addEventListener('animationend', function handler(e) {
        if (e.animationName === 'giggle') {
          baymaxEl.classList.remove('giggling');
          baymaxEl.removeEventListener('animationend', handler);
        }
      });
    }
    petCount = 0;
  }, 600);
}

if (bellyEl) {
  bellyEl.addEventListener('mousemove', (e) => {
    if (e.buttons === 1 && !isSleeping) handleBellyPet();
  });
}
if (chestEl) {
  chestEl.addEventListener('mousemove', (e) => {
    if (e.buttons === 1 && !isSleeping) handleBellyPet();
  });
}

// ══════════════════════════════════
//  FACE POKE (rapid blink)
// ══════════════════════════════════

if (headEl) {
  headEl.addEventListener('click', (e) => {
    if (isSleeping) return;
    e.stopPropagation();
    if (dragMoved) return;
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach(eye => {
      eye.classList.add('poked');
      eye.addEventListener('animationend', () => eye.classList.remove('poked'), { once: true });
    });
    setMood('surprised');
    playClip(VOICE_CLIPS[5]);
  });
}

// ══════════════════════════════════
//  IDLE DETECTION
// ══════════════════════════════════

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  if (isSleeping) return;
  idleTimer = setTimeout(() => {
    if (isSleeping) return;
    setMood('tilt');
    const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    speakTTS(line);
  }, 5 * 60 * 1000);
}

// ── Click Interactions ──

let clickCount = 0;
let clickTimer = null;

baymaxEl.addEventListener('click', (e) => {
  if (isSleeping || dragMoved) return;
  e.stopPropagation();
  clickCount++;
  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    if (clickCount === 1) {
      if (Math.random() < 0.2) randomMoodReaction();
      if (Math.random() < 0.3) {
        speakTTS(HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)]);
      } else {
        playRandomClip();
      }
    } else if (clickCount >= 2) {
      playGreeting();
      wave();
    }
    clickCount = 0;
  }, 300);
});

// ── Context Menu ──

let contextMenu = null;

function createContextMenu(x, y) {
  removeContextMenu();
  contextMenu = document.createElement('div');
  contextMenu.id = 'context-menu';

  const items = [
    { label: 'Health Tip', action: () => speakTTS(HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)]) },
    { label: 'Ba la la la', action: () => playClip(VOICE_CLIPS[1]) },
    { label: 'Wave', action: () => { wave(); playGreeting(); } },
    { label: 'Fist Bump', action: () => playClip(VOICE_CLIPS[6]) },
    { label: 'separator' },
    { label: 'Sit on Taskbar', action: sitOnTaskbar },
    { label: 'separator' },
    { label: 'Happy', action: () => { setMood('happy'); speakTTS("I am satisfied with your care."); } },
    { label: 'Sad', action: () => { setMood('sad'); speakTTS("Oh no."); } },
    { label: 'Surprised', action: () => { setMood('surprised'); playClip(VOICE_CLIPS[5]); } },
    { label: 'Head Tilt', action: () => setMood('tilt') },
    { label: 'separator' },
    { label: 'Sleep', action: sleep },
    { label: 'Exit', action: () => window.baymax.quit() }
  ];

  items.forEach(item => {
    if (item.label === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      contextMenu.appendChild(sep);
    } else {
      const div = document.createElement('div');
      div.className = 'menu-item';
      div.textContent = item.label;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        removeContextMenu();
        item.action();
      });
      contextMenu.appendChild(div);
    }
  });

  contextMenu.style.left = Math.min(x, 180) + 'px';
  contextMenu.style.top = Math.min(y, 400) + 'px';
  document.body.appendChild(contextMenu);
}

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

baymaxEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isSleeping) return;
  createContextMenu(e.clientX, e.clientY);
});

document.addEventListener('click', removeContextMenu);

// ── Sleep / Wake ──

function sleep() {
  if (isSleeping) return;
  isSleeping = true;
  stopBlink();
  stopAudio();
  hideSpeechBubble();
  if (idleTimer) clearTimeout(idleTimer);
  baymaxEl.classList.remove('visible', 'breathing');
  baymaxEl.classList.add('sleeping');
}

function wakeUp() {
  if (!isSleeping) return;
  isSleeping = false;
  baymaxEl.classList.remove('sleeping', 'hidden-below');
  baymaxEl.classList.add('visible');
  setTimeout(() => {
    baymaxEl.classList.add('breathing');
    wave();
    playGreeting();
    scheduleBlink();
    resetIdleTimer();
  }, 600);
}

window.baymax.onSleep(() => sleep());
window.baymax.onWakeUp(() => wakeUp());

// ── Startup Sequence ──

function startup() {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    selectedVoice = findBestVoice();
  };

  setTimeout(() => {
    baymaxEl.classList.remove('hidden-below');
    baymaxEl.classList.add('visible');

    setTimeout(() => {
      baymaxEl.classList.add('breathing');

      setTimeout(() => {
        wave();
        setTimeout(() => {
          playGreeting();
        }, 400);
      }, 300);

      scheduleBlink();
      startCursorPolling();
      resetIdleTimer();
    }, 1500);
  }, 800);
}

window.addEventListener('DOMContentLoaded', startup);
