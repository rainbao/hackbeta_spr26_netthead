const AUDIO_PATHS = {
  bgm: null,
  menuBgm: {
    hero: "/assets/menu_hero2.mp3",
    villain: "/assets/menu_villain2.mp3",
    neutral: ["/assets/menu_hero2.mp3", "/assets/menu_villain2.mp3"],
  },
  combatBgm: {
    hero: [
      "/assets/combat_hero1.mp3",
      "/assets/combat_hero2.mp3",
      "/assets/combat_hero3.mp3",
    ],
    villain: [
      "/assets/combat_villain1.mp3",
      "/assets/combat_villain2.mp3",
      "/assets/combat_villian3.mp3",
    ],
    neutral: [
      "/assets/combat_hero1.mp3",
      "/assets/combat_hero2.mp3",
      "/assets/combat_hero3.mp3",
      "/assets/combat_villain1.mp3",
      "/assets/combat_villain2.mp3",
      "/assets/combat_villian3.mp3",
    ],
  },
  jingles: {
    shop: {
      hero: "/assets/store_hero1.mp3",
      villain: "/assets/store_villain1.mp3",
      neutral: ["/assets/store_hero1.mp3", "/assets/store_villain1.mp3"],
    },
    rest: {
      hero: "/assets/store_hero2.mp3",
      villain: "/assets/store_villain2.mp3",
      neutral: ["/assets/store_hero2.mp3", "/assets/store_villain2.mp3"],
    },
    victory: {
      hero: ["/assets/victory_hero1.mp3", "/assets/victory_hero2.mp3"],
      villain: ["/assets/victory_villain.mp3", "/assets/victory_villian2.mp3"],
      neutral: ["/assets/victory_hero1.mp3", "/assets/victory_villain.mp3"],
    },
  },
  turnEnd: ["/assets/turn_end1.ogg", "/assets/turn_end2.ogg", "/assets/turn_end3.ogg"],
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
  placeByType: {
    defend: "/assets/skill_fortify.ogg",
    magic: "/assets/skill_channeling.ogg",
    draw: "/assets/card_draw.ogg",
    heal: "/assets/skill_echo.ogg",
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
  let bgmPath = null;
  const sfxCache = new Map();
  const missing = new Set();

  const pickForAlignment = (source, alignment = "neutral") => {
    if (!source) return null;
    const key = alignment === "hero" || alignment === "villain" ? alignment : "neutral";
    const value = source[key] ?? source.neutral ?? source.hero ?? source.villain ?? null;
    return pickOne(value);
  };

  const playBgmPath = (path, volume = 0.35) => {
    if (!enabled || !path) return;
    if (!bgm || bgmPath !== path) {
      if (bgm) {
        bgm.pause();
      }
      bgm = makeClip(path, { loop: true, volume });
      bgm.onerror = () => {
        bgm = null;
        bgmPath = null;
      };
      bgmPath = path;
    }
    if (!bgm) return;
    bgm.volume = volume;
    bgm.muted = muted;
    bgm.play().catch(() => {});
  };

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

  const playSfx = (path, volume = 1, startAt = 0) => {
    if (!enabled || muted) return;
    const clip = getSfx(path);
    if (!clip) return;
    try {
      if (startAt > 0 && clip.readyState >= 1) {
        clip.currentTime = startAt;
      } else {
        clip.currentTime = 0;
      }
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
      // Warm up frequently used clips to reduce first-play latency.
      getSfx(config.select);
      getSfx(config.draw);
      getSfx(config.placeByKeyword.channel);
    },
    setMuted(nextMuted) {
      muted = !!nextMuted;
      if (bgm) {
        bgm.muted = muted;
      }
    },
    startBgm() {
      playBgmPath(config.bgm || pickForAlignment(config.menuBgm, "neutral"), 0.34);
    },
    playMenuBgm(alignment = "neutral") {
      playBgmPath(pickForAlignment(config.menuBgm, alignment), 0.34);
    },
    playCombatBgm(alignment = "neutral") {
      playBgmPath(pickForAlignment(config.combatBgm, alignment), 0.4);
    },
    playJingle(kind, alignment = "neutral") {
      const path = pickForAlignment(config.jingles?.[kind], alignment);
      if (!path) return;
      playSfx(path, 0.85);
    },
    // Play a jingle as a non-looping BGM track so it can be interrupted by the next playMenuBgm/playCombatBgm call.
    playJingleBgm(kind, alignment = "neutral") {
      const path = pickForAlignment(config.jingles?.[kind], alignment);
      if (!path) return;
      if (bgm) { bgm.pause(); }
      bgm = makeClip(path, { loop: false, volume: 0.75 });
      bgm.onerror = () => { bgm = null; bgmPath = null; };
      bgmPath = path;
      bgm.muted = muted;
      bgm.play().catch(() => {});
    },
    stopBgm() {
      if (!bgm) return;
      bgm.pause();
      bgm.currentTime = 0;
      bgmPath = null;
    },
    playTurnEnd() {
      playSfx(pickOne(config.turnEnd), 0.9);
    },
    playSelect() {
      playSfx(config.select, 0.85);
    },
    playDraw() {
      playSfx(config.draw, 0.85);
    },
    playMomentumStage(stage) {
      const clips = config.placeByKeyword.momentum;
      if (Array.isArray(clips) && clips.length > 0) {
        const idx = Math.max(0, Math.min(3, (Number(stage) || 1) - 1));
        playSfx(clips[idx], 0.85);
        return;
      }
      playSfx(pickOne(clips), 0.85);
    },
    playPlace(keyword, cardType) {
      const key = String(keyword || "").toLowerCase();
      const typeKey = String(cardType || "").toLowerCase();
      let path = pickOne(config.placeByKeyword[key]);
      if (!path) {
        path = config.placeByType[typeKey];
      }
      path = path || config.placeDefault;
      const volume = key === "fortify" || (!config.placeByKeyword[key] && typeKey === "defend") ? 1.0 : 0.6;
      const isChannelPath = path === config.placeByKeyword.channel;
      const startAt = isChannelPath ? 0.06 : 0;
      playSfx(path, volume, startAt);
    },
  };
}
