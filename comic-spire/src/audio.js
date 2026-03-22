const AUDIO_PATHS = {
  bgm: "/assets/audio/bgm.mp3",
  select: "/assets/audio/ui/card-select.mp3",
  placeDefault: "/assets/audio/cards/place-default.mp3",
  placeByKeyword: {
    combo: "/assets/audio/cards/place-combo.mp3",
    frenzy: "/assets/audio/cards/place-frenzy.mp3",
    channel: "/assets/audio/cards/place-channel.mp3",
    momentum: "/assets/audio/cards/place-momentum.mp3",
    fortify: "/assets/audio/cards/place-fortify.mp3",
    corrode: "/assets/audio/cards/place-corrode.mp3",
    blood: "/assets/audio/cards/place-blood.mp3",
    charge: "/assets/audio/cards/place-charge.mp3",
    echo: "/assets/audio/cards/place-echo.mp3",
    shieldbash: "/assets/audio/cards/place-shieldbash.mp3",
    catalyze: "/assets/audio/cards/place-catalyze.mp3",
    overchannel: "/assets/audio/cards/place-overchannel.mp3",
  },
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
    playPlace(keyword) {
      const key = String(keyword || "").toLowerCase();
      const path = config.placeByKeyword[key] || config.placeDefault;
      playSfx(path, 0.6);
    },
  };
}
