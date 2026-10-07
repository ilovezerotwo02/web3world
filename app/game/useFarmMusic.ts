"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const FARM_MUSIC_STORAGE_KEY = "monad-pixel-farm:v35:music-enabled";

const FARM_MUSIC_SRC = "/audio/lkwgbgm.mp3";

type FarmMusicState = {
  enabled: boolean;
  remembered: boolean;
  toggle: () => void;
};

export function useFarmMusic(): FarmMusicState {
  const [enabled, setEnabled] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);

  const getAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(FARM_MUSIC_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.35;
    audioRef.current = audio;
    return audio;
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setEnabled(false);
  }, []);

  const start = useCallback(async () => {
    const audio = getAudio();
    try {
      await audio.play();
      enabledRef.current = true;
      window.localStorage.setItem(FARM_MUSIC_STORAGE_KEY, "1");
      setRemembered(true);
      setEnabled(true);
    } catch {
      enabledRef.current = false;
      setEnabled(false);
    }
  }, [getAudio]);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      window.localStorage.setItem(FARM_MUSIC_STORAGE_KEY, "0");
      setRemembered(false);
      stop();
      return;
    }
    void start();
  }, [start, stop]);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      setRemembered(window.localStorage.getItem(FARM_MUSIC_STORAGE_KEY) === "1");
    });
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!audio || !enabledRef.current) return;
      if (document.hidden) audio.pause();
      else void audio.play();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      document.removeEventListener("visibilitychange", handleVisibility);
      enabledRef.current = false;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      audioRef.current = null;
    };
  }, []);

  return { enabled, remembered, toggle };
}
