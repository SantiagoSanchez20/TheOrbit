"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAudio, Track } from "../../components/AudioContext";

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
  const { playTrack, currentTrack } = useAudio();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3000/map/artist/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setArtist(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  function handlePlayTrack(track: Track) {
    if (!artist) return;
    const queue = (artist.topTracks || []).map((t) => ({
      ...t,
      artistName: artist.name,
    }));
    playTrack({ ...track, artistName: artist.name }, queue);
  }

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
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "Geologica, sans-serif", color: "white", paddingBottom: "100px" }}>

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

        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, color: "white", padding: "6px 16px", cursor: "pointer", fontSize: 13 }}
        >
          ← Volver
        </button>

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
              onClick={() => track.deezer_id && handlePlayTrack(track)}  // ← use deezer_id, not preview_url
              style={{
                cursor: track.deezer_id ? "pointer" : "default",         // ← use deezer_id, not preview_url
                opacity: track.deezer_id ? 1 : 0.5,                      // ← use deezer_id, not preview_url
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
    </div>
  );
}