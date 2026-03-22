const AUDIO_PATHS = {
  bgm: null,
  select: "/assets/card_select.ogg",
  draw: "/assets/card_draw.ogg",
  placeDefault: "/assets/attack_punch.ogg",
  placeByKeyword: {
    combo: "/assets/attack_combo.ogg",
    frenzy: "/assets/attack_frenzy.ogg",
    channel: "/assets/skill_channeling.ogg",
    momentum: [
      "/assets/skill_momentum1.ogg",
      "/assets/skill_momentum2.ogg",
      "/assets/skill_momentum3.ogg",
      "/assets/skill_momentum4.ogg",
    ],
    fortify: "/assets/skill_fortify.ogg",
    corrode: "/assets/attack_corrode.ogg",
    blood: "/assets/attack_blood.ogg",
    charge: "/assets/shield_break.ogg",
    echo: "/assets/skill_echo.ogg",
    shieldbash: "/assets/attack_shield_bash.ogg",
    catalyze: "/assets/skill_catalyze.ogg",
    overchannel: "/assets/skill_channeling.ogg",
  },
};

const pickOne = (value) => {
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)] || null;
  }
  return value || null;
};

function makeClip(path, { loop = false, volume = 1 } = {}) {
  const audio = new Audio(path);
  audio.preload = "auto";
  audio.loop = loop;
  audio.volume = volume;
  return audio;
}

export function createAudioSystem(config = AUDIO_PATHS) {
  let enabled = false;
  let muted = false;
  let bgm = null;
  const sfxCache = new Map();
  const missing = new Set();

  const getSfx = (path) => {
    if (!path || missing.has(path)) return null;
    if (sfxCache.has(path)) return sfxCache.get(path);
    const clip = makeClip(path);
    clip.onerror = () => {
      missing.add(path);
      sfxCache.delete(path);
    };
    sfxCache.set(path, clip);
    return clip;
  };

  const playSfx = (path, volume = 1) => {
    if (!enabled || muted) return;
    const clip = getSfx(path);
    if (!clip) return;
    try {
      clip.currentTime = 0;
      clip.volume = volume;
      clip.play().catch(() => {});
    } catch {
      // Ignore playback issues in scaffold mode.
    }
  };

  return {
    paths: config,
    unlock() {
      enabled = true;
    },
    setMuted(nextMuted) {
      muted = !!nextMuted;
      if (bgm) {
        bgm.muted = muted;
      }
    },
    startBgm() {
      if (!enabled) return;
      if (!config.bgm) return;
      if (!bgm) {
        bgm = makeClip(config.bgm, { loop: true, volume: 0.35 });
        bgm.onerror = () => {
          bgm = null;
        };
      }
      if (!bgm) return;
      bgm.muted = muted;
      bgm.play().catch(() => {});
    },
    stopBgm() {
      if (!bgm) return;
      bgm.pause();
      bgm.currentTime = 0;
    },
    playSelect() {
      playSfx(config.select, 0.55);
    },
    playDraw() {
      playSfx(config.draw, 0.45);
    },
    playPlace(keyword) {
      const key = String(keyword || "").toLowerCase();
      const path = pickOne(config.placeByKeyword[key]) || config.placeDefault;
      playSfx(path, 0.6);
    },
  };
}
