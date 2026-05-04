"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

interface SearchResult {
  _id: string;
  spotify_id: string;
  name: string;
  profile_image: string | null;
  genres: string[];
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function Navbar() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Leer sesión al montar ─────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch (_) {}
  }, []);

  // ── Cerrar menú al hacer click fuera ─────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Buscar artistas con debounce ──────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchValue.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `http://localhost:3000/map/artists?x1=-5000&y1=-5000&x2=5000&y2=5000&limit=100`
        );
        const data = await res.json();
        const filtered = (data.artists ?? []).filter((a: SearchResult) =>
          a.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        setResults(filtered.slice(0, 6));
      } catch (_) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchValue]);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
    setMenuOpen(false);
    router.push("/inicio");
  }

  function handleSelectResult(artist: SearchResult) {
    setSearchValue("");
    setResults([]);
    setSearchFocused(false);
    router.push(`/artist/${artist.spotify_id}`);
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;700&display=swap"
        rel="stylesheet"
      />

      <header style={styles.navbar}>
        {/* Logo izquierda */}
        <div style={styles.logoWrap}>
          <Image
            src="/LogoConejo.png"
            alt="The Orbit"
            width={38}
            height={38}
            style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
            priority
          />
        </div>

        {/* Buscador centro */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              ...styles.searchWrap,
              border: searchFocused
                ? "1.5px solid rgba(157,51,255,0.9)"
                : "1.5px solid rgba(255,255,255,0.12)",
              boxShadow: searchFocused
                ? "0 0 20px rgba(157,51,255,0.3), inset 0 0 10px rgba(157,51,255,0.05)"
                : "none",
            }}
          >
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={searchFocused ? "#9d33ff" : "rgba(255,255,255,0.35)"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "stroke 0.3s" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              type="text"
              placeholder="Busca un artista..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              style={styles.searchInput}
            />

            {!searchFocused && searchValue === "" && (
              <span style={styles.shortcut}>⌘K</span>
            )}
          </div>

          {/* Dropdown de resultados */}
          {searchFocused && (searchValue.trim() !== "") && (
            <div style={styles.dropdown}>
              {searching && (
                <p style={styles.dropdownMsg}>Buscando...</p>
              )}
              {!searching && results.length === 0 && (
                <p style={styles.dropdownMsg}>Sin resultados para "{searchValue}"</p>
              )}
              {!searching && results.map((artist) => (
                <div
                  key={artist._id}
                  style={styles.dropdownItem}
                  onMouseDown={() => handleSelectResult(artist)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(157,51,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  {artist.profile_image ? (
                    <img
                      src={artist.profile_image}
                      alt={artist.name}
                      style={styles.dropdownImg}
                    />
                  ) : (
                    <div style={{ ...styles.dropdownImg, background: "rgba(157,51,255,0.2)" }} />
                  )}
                  <div>
                    <p style={styles.dropdownName}>{artist.name}</p>
                    <p style={styles.dropdownGenre}>
                      {artist.genres?.slice(0, 2).join(", ") || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menú derecha */}
        <nav style={styles.menu}>
          <NavBtn icon="↓" label="APP" />
          <NavBtn label="INICIO" onClick={() => router.push("/inicio")} />
          <div style={styles.divider} />

          {user ? (
            // ── Usuario logueado ──────────────────────────
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                style={styles.avatarBtn}
                onClick={() => setMenuOpen((o) => !o)}
                title={user.username}
              >
                <div style={styles.avatarCircle}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </button>

              {menuOpen && (
                <div style={styles.hamburgerMenu}>
                  <p style={styles.menuUsername}>@{user.username}</p>
                  <div style={styles.menuDivider} />
                  <button style={styles.menuItem} onClick={handleLogout}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            // ── No logueado ───────────────────────────────
            <button
              style={styles.joinBtn}
              onClick={() => router.push("/den")}
            >
              ÚNETE
            </button>
          )}
        </nav>
      </header>
    </>
  );
}

function NavBtn({ label, icon, onClick }: { label: string; icon?: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navBtn,
        color: hovered ? "#fff" : "rgba(255,255,255,0.6)",
        letterSpacing: hovered ? "2px" : "1.5px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon && <span style={{ fontSize: "13px" }}>{icon} </span>}
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    boxSizing: "border-box",
    zIndex: 100,
    background: "linear-gradient(180deg, rgba(13,0,26,0.98) 0%, rgba(13,0,26,0.85) 100%)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(157,51,255,0.2)",
    boxShadow: "0 4px 30px rgba(0,0,0,0.4)",
    fontFamily: "'Geologica', sans-serif",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "340px",
    height: "38px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "10px",
    padding: "0 14px",
    boxSizing: "border-box",
    transition: "border 0.3s, box-shadow 0.3s",
  },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "rgba(255,255,255,0.85)",
    fontSize: "13px",
    fontFamily: "'Geologica', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.5px",
  },
  shortcut: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.07)",
    padding: "2px 6px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
    flexShrink: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    width: "340px",
    background: "rgba(13,0,26,0.97)",
    border: "1px solid rgba(157,51,255,0.3)",
    borderRadius: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    zIndex: 200,
    overflow: "hidden",
  },
  dropdownMsg: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    padding: "12px 16px",
    margin: 0,
    fontFamily: "'Geologica', sans-serif",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  dropdownImg: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    border: "1px solid rgba(157,51,255,0.3)",
  },
  dropdownName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "white",
    fontFamily: "'Geologica', sans-serif",
  },
  dropdownGenre: {
    margin: 0,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "'Geologica', sans-serif",
  },
  menu: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  navBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: "'Geologica', sans-serif",
    letterSpacing: "1.5px",
    padding: "8px 12px",
    borderRadius: "6px",
    transition: "color 0.2s, letter-spacing 0.2s",
  },
  divider: {
    width: "1px",
    height: "20px",
    background: "rgba(255,255,255,0.1)",
    margin: "0 4px",
  },
  joinBtn: {
    background: "#9d33ff",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: "'Geologica', sans-serif",
    letterSpacing: "2px",
    color: "#fff",
    padding: "9px 20px",
    borderRadius: "8px",
    boxShadow: "0 0 16px rgba(157,51,255,0.5)",
    transition: "box-shadow 0.3s, transform 0.2s",
  },
  avatarBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#9d33ff",
    color: "white",
    fontSize: 15,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Geologica', sans-serif",
    boxShadow: "0 0 12px rgba(157,51,255,0.5)",
  },
  hamburgerMenu: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    width: 180,
    background: "rgba(13,0,26,0.97)",
    border: "1px solid rgba(157,51,255,0.3)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    zIndex: 200,
    overflow: "hidden",
    padding: "8px 0",
  },
  menuUsername: {
    margin: 0,
    padding: "8px 16px",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "'Geologica', sans-serif",
  },
  menuDivider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "4px 0",
  },
  menuItem: {
    width: "100%",
    background: "none",
    border: "none",
    color: "#f87171",
    fontSize: 13,
    fontFamily: "'Geologica', sans-serif",
    padding: "10px 16px",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.15s",
  },
};