"use client";

import { createContext, useContext, useRef, useState, useCallback } from "react";

export interface Track {
  id: string;
  name: string;
  deezer_id: string;          // ← replaces preview_url as the permanent identifier
  album_art: string;
  album_name: string;
  artistName: string;
}

interface AudioContextType {
  currentTrack: Track | null;
  playing: boolean;
  progress: number;
  visible: boolean;
  queue: Track[];
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  closePlayer: () => void;
}

const AudioCtx = createContext<AudioContextType | null>(null);

const API_BASE = "http://localhost:3000";

/** Fetches a fresh, non-expired Deezer preview URL at playback time */
async function fetchPreviewUrl(deezerTrackId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/map/preview/${deezerTrackId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.preview_url ?? null;
  } catch {
    return null;
  }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startTrack = useCallback(async (track: Track) => {
    if (!track.deezer_id) return;

    // Fetch a fresh URL every time — never use a stored one
    const previewUrl = await fetchPreviewUrl(track.deezer_id);
    if (!previewUrl) return;

    audioRef.current?.pause();
    clearTimer();

    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setCurrentTrack(track);
    setProgress(0);
    setPlaying(true);
    setVisible(true);

    audio.play().catch(() => setPlaying(false));

    intervalRef.current = setInterval(() => {
      if (!audio.duration) return;
      setProgress((audio.currentTime / audio.duration) * 100);
    }, 500);

    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      clearTimer();
      // Auto-next
      setCurrentTrack((prev) => {
        if (!prev) return null;
        setQueue((q) => {
          const idx = q.findIndex((t) => t.id === prev.id);
          const next = q[idx + 1];
          if (next) setTimeout(() => startTrack(next), 300);
          return q;
        });
        return prev;
      });
    };
  }, []);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (newQueue) setQueue(newQueue);
    startTrack(track);
  }, [startTrack]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      clearTimer();
    } else {
      audioRef.current.play();
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        if (!audioRef.current?.duration) return;
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      }, 500);
    }
  }, [playing]);

  const next = useCallback(() => {
    setCurrentTrack((prev) => {
      if (!prev) return null;
      setQueue((q) => {
        const idx = q.findIndex((t) => t.id === prev.id);
        const nextTrack = q[idx + 1];
        if (nextTrack) setTimeout(() => startTrack(nextTrack), 0);
        return q;
      });
      return prev;
    });
  }, [startTrack]);

  const prev = useCallback(() => {
    setCurrentTrack((prev) => {
      if (!prev) return null;
      setQueue((q) => {
        const idx = q.findIndex((t) => t.id === prev.id);
        const prevTrack = q[idx - 1];
        if (prevTrack) setTimeout(() => startTrack(prevTrack), 0);
        return q;
      });
      return prev;
    });
  }, [startTrack]);

  const closePlayer = useCallback(() => {
    audioRef.current?.pause();
    clearTimer();
    setPlaying(false);
    setVisible(false);
    setCurrentTrack(null);
    setProgress(0);
    setQueue([]);
  }, []);

  return (
    <AudioCtx.Provider value={{
      currentTrack, playing, progress, visible, queue,
      playTrack, togglePlay, next, prev, closePlayer,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}