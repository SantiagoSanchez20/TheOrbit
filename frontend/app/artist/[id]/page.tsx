"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Track {
  id: string;
  name: string;
  preview_url: string | null;
  youtube_id: string | null;
  album_art: string;
  album_name: string;
}

interface Artist {
  _id: string;
  spotify_id: string;
  name: string;
  profile_image: string;
  genres: string[];
  popularity: number;
  followers: number;
  topTracks: Track[];
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [youtubeKey, setYoutubeKey] = useState(0); // force iframe remount on play/pause
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch(`http://localhost:3000/map/artist/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setArtist(data);
        if (data.topTracks?.length > 0) {
          const firstPlayable = data.topTracks.find(
            (t: Track) =>
              (t.preview_url && t.preview_url.trim() !== '') || t.youtube_id
          );
          setCurrentTrack(firstPlayable ?? data.topTracks[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  function isPlayable(track: Track) {
    return (track.preview_url && track.preview_url.trim() !== '') || !!track.youtube_id;
  }

  function playTrack(track: Track) {
    if (!isPlayable(track)) return;

    // Stop any existing Deezer audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      if (progressInterval.current) clearInterval(progressInterval.current);
    }

    setCurrentTrack(track);
    setProgress(0);

    if (track.preview_url && track.preview_url.trim() !== '') {
      // Play via Deezer preview
      const audio = new Audio(track.preview_url);
      audioRef.current = audio;
      audio.play().catch((e) => {
        console.warn('Audio play failed:', e);
        setPlaying(false);
      });
      setPlaying(true);
      progressInterval.current = setInterval(() => {
        setProgress((audio.currentTime / audio.duration) * 100 || 0);
      }, 500);
      audio.onended = () => {
        setPlaying(false);
        setProgress(0);
        if (progressInterval.current) clearInterval(progressInterval.current);
      };
    } else if (track.youtube_id) {
      // Play via YouTube iframe — remount with autoplay
      setPlaying(true);
      setYoutubeKey((k) => k + 1);
    }
  }

  function togglePlay() {
    if (!currentTrack) return;

    if (currentTrack.preview_url && currentTrack.preview_url.trim() !== '') {
      // Deezer toggle
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
        if (progressInterval.current) clearInterval(progressInterval.current);
      } else {
        audioRef.current.play();
        setPlaying(true);
        progressInterval.current = setInterval(() => {
          setProgress((audioRef.current!.currentTime / audioRef.current!.duration) * 100 || 0);
        }, 500);
      }
    } else if (currentTrack.youtube_id) {
      // YouTube toggle — remount iframe with/without autoplay
      setPlaying((p) => {
        setYoutubeKey((k) => k + 1);
        return !p;
      });
    }
  }

  function skipTrack(dir: "prev" | "next") {
    if (!artist || !currentTrack) return;
    const idx = artist.topTracks.findIndex((t) => t.id === currentTrack.id);
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next >= 0 && next < artist.topTracks.length) playTrack(artist.topTracks[next]);
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  if (loading) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "white", fontFamily: "Geologica, sans-serif" }}>Cargando...</p>
    </div>
  );

  if (!artist) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "white", fontFamily: "Geologica, sans-serif" }}>Artista no encontrado.</p>
    </div>
  );

  const uniqueAlbums = Array.from(
    new Map((artist.topTracks || []).map((t) => [t.album_name, t])).values()
  );

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "Geologica, sans-serif", color: "white", paddingBottom: "120px" }}>

      {/* ── Header banner ── */}
      <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden" }}>
        {artist.profile_image && (
          <img
            src={artist.profile_image}
            alt={artist.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) blur(4px)", transform: "scale(1.05)" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 24, padding: "0 32px" }}>
          <img
            src={artist.profile_image}
            alt={artist.name}
            style={{ width: 100, height: 100, borderRadius: "50%", border: "3px solid #9d33ff", objectFit: "cover", flexShrink: 0 }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2 }}>Artista</p>
            <h1 style={{ margin: "4px 0 8px", fontSize: 42, fontWeight: 700 }}>{artist.name}</h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {artist.genres.slice(0, 4).map((g) => (
                <span key={g} style={{ background: "rgba(157,51,255,0.2)", border: "1px solid rgba(157,51,255,0.4)", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "#c084fc" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Oyentes</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{artist.followers.toLocaleString()}</p>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, color: "white", padding: "6px 16px", cursor: "pointer", fontSize: 13 }}
        >
          ← Volver
        </button>

        {/* Spotify link */}
        <a
          href={`https://open.spotify.com/artist/${artist.spotify_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ position: "absolute", top: 16, right: 16, background: "#1DB954", borderRadius: 20, color: "white", padding: "6px 16px", fontSize: 13, textDecoration: "none", fontWeight: 600 }}
        >
          Abrir en Spotify
        </a>
      </div>

      <div style={{ padding: "32px 32px 0" }}>

        {/* ── Canciones ── */}
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>CANCIONES</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginBottom: 40 }}>
          {(artist.topTracks || []).map((track) => (
            <div
              key={track.id}
              onClick={() => playTrack(track)}
              style={{
                cursor: isPlayable(track) ? "pointer" : "default",
                opacity: isPlayable(track) ? 1 : 0.5,
                background: currentTrack?.id === track.id ? "rgba(157,51,255,0.2)" : "rgba(255,255,255,0.05)",
                border: currentTrack?.id === track.id ? "1px solid #9d33ff" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                overflow: "hidden",
                transition: "all 0.2s",
              }}
            >
              <img src={track.album_art} alt={track.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              <div style={{ padding: "8px 10px" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.album_name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Álbumes ── */}
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>ÁLBUMES</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
          {uniqueAlbums.map((t) => (
            <div key={t.album_name} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              <img src={t.album_art} alt={t.album_name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              <div style={{ padding: "8px 10px" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.album_name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Player bar ── */}
      {currentTrack && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(157,51,255,0.3)",
          display: "flex", alignItems: "center", gap: 16, padding: "12px 24px", zIndex: 100,
        }}>
          <img src={currentTrack.album_art} alt={currentTrack.name} style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover" }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentTrack.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{artist.name}</p>
          </div>

          {/* Controls — pinned to center */}
          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            width: 400,
          }}>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <button onClick={() => skipTrack("prev")} style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer" }}>⏮</button>
              <button
                onClick={togglePlay}
                disabled={!isPlayable(currentTrack)}
                style={{ background: "#9d33ff", border: "none", borderRadius: "50%", width: 40, height: 40, color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {playing ? "⏸" : "▶"}
              </button>
              <button onClick={() => skipTrack("next")} style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer" }}>⏭</button>
            </div>

            {/* Deezer progress bar */}
            {currentTrack.preview_url && (
              <div style={{ width: "100%", maxWidth: 400, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2 }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "#9d33ff", borderRadius: 2, transition: "width 0.5s linear" }} />
              </div>
            )}

            {/* YouTube label */}
            {currentTrack.youtube_id && !currentTrack.preview_url && (
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                vía YouTube
              </p>
            )}
          </div>

          {/* Hidden YouTube iframe */}
          {currentTrack.youtube_id && !currentTrack.preview_url && playing && (
            <iframe
              key={`${currentTrack.youtube_id}-${youtubeKey}`}
              src={`https://www.youtube.com/embed/${currentTrack.youtube_id}?autoplay=1&controls=0`}
              allow="autoplay"
              style={{ width: 0, height: 0, border: "none", position: "absolute" }}
            />
          )}

          {!isPlayable(currentTrack) && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>Sin preview</p>
          )}
        </div>
      )}
    </div>
  );
}