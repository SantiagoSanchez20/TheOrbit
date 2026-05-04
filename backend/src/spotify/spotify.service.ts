import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Artist, ArtistDocument } from '../map/artists.schema';

@Injectable()
export class SpotifyService implements OnModuleInit {
  private readonly logger = new Logger(SpotifyService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private static computeGenreAngles(): Record<string, number> {
    const genres = [
      'pop', 'dance pop', 'k-pop', 'electropop',
      'electronic', 'edm', 'house', 'techno',
      'hip hop', 'rap', 'trap',
      'r&b', 'soul', 'funk',
      'jazz', 'blues',
      'classical', 'ambient',
      'folk', 'country', 'bluegrass',
      'rock', 'indie rock', 'alternative', 'metal', 'punk',
      'reggae', 'dancehall',
      'latin', 'salsa', 'bachata', 'cumbia', 'reggaeton',
    ];

    const result: Record<string, number> = {};
    genres.forEach((g, i) => {
      result[g] = (i / genres.length) * 2 * Math.PI;
    });
    return result;
  }

  private static readonly GENRE_ANGLES = SpotifyService.computeGenreAngles();

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Artist.name) private artistModel: Model<ArtistDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureToken();
  }

  // ── Spotify Token ─────────────────────────────────────────────────────────

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return;

    const clientId = this.config.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.config.get<string>('SPOTIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Spotify token error: ${err}`);
      throw new Error('Failed to obtain Spotify access token');
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    this.logger.log('Spotify access token refreshed');
  }

  private async spotifyGet<T>(path: string): Promise<T> {
    await this.ensureToken();
    const fullUrl = `https://api.spotify.com/v1${path}`;
    const res = await fetch(fullUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Spotify API error ${res.status}: ${errorText}`);
      throw new Error(`Spotify API error ${res.status}: ${path}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Last.fm ───────────────────────────────────────────────────────────────

  private async lastFmGetArtist(name: string): Promise<{ listeners: number; tags: string[] }> {
    const apiKey = this.config.get<string>('LASTFM_API_KEY');
    if (!apiKey) {
      this.logger.warn('LASTFM_API_KEY not set');
      return { listeners: 0, tags: [] };
    }

    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${apiKey}&format=json`;
      const res = await fetch(url);

      if (!res.ok) {
        this.logger.warn(`Last.fm request failed for ${name}: ${res.status}`);
        return { listeners: 0, tags: [] };
      }

      const data = await res.json() as LastFmArtistResponse;

      if (!data.artist) {
        this.logger.warn(`Last.fm: no data found for "${name}"`);
        return { listeners: 0, tags: [] };
      }

      const listeners = parseInt(data.artist.stats?.listeners ?? '0', 10);
      const tags = data.artist.tags?.tag?.map((t) => t.name.toLowerCase()) ?? [];

      this.logger.log(`Last.fm - ${name}: listeners=${listeners}, tags=${tags.join(', ') || 'none'}`);
      return { listeners, tags };
    } catch (e) {
      this.logger.warn(`Last.fm fetch failed for ${name}: ${e}`);
      return { listeners: 0, tags: [] };
    }
  }

  // ── Spatial Algorithm ─────────────────────────────────────────────────────

  computeCoordinates(genres: string[], seed: string, listeners: number): { x: number; y: number } {
    const MAX_RADIUS = 1200;

    let r: number;
    let theta: number;

    if (listeners > 0) {
      const maxLog = Math.log10(100_000_000);
      const logListeners = Math.log10(Math.max(listeners, 1));
      const normalized = Math.min(logListeners / maxLog, 1);
      const MIN_RADIUS = 200;
      r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * (1 - normalized);
    } else {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      }
      const hashNorm = (hash % 10000) / 10000;
      r = MAX_RADIUS * 0.3 + hashNorm * MAX_RADIUS * 0.6;
    }

    if (genres.length > 0) {
      let totalWeight = 0;
      let weightedAngle = 0;
      genres.forEach((genre, i) => {
        const weight = 1 / (i + 1);
        const angle =
          SpotifyService.GENRE_ANGLES[genre.toLowerCase()] ??
          this.hashGenreToAngle(genre);
        weightedAngle += angle * weight;
        totalWeight += weight;
      });
      theta = weightedAngle / totalWeight;
    } else {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      }
      theta = ((hash % 1000) / 1000) * 2 * Math.PI;
    }

    return {
      x: parseFloat((r * Math.cos(theta)).toFixed(4)),
      y: parseFloat((r * Math.sin(theta)).toFixed(4)),
    };
  }

  private hashGenreToAngle(genre: string): number {
    let hash = 0;
    for (let i = 0; i < genre.length; i++) {
      hash = (hash * 31 + genre.charCodeAt(i)) >>> 0;
    }
    return ((hash % 1000) / 1000) * 2 * Math.PI;
  }

  // ── Seeding ───────────────────────────────────────────────────────────────

  async fetchAndSeedArtist(spotifyId: string, artistName?: string): Promise<ArtistDocument> {
    const artistData = await this.spotifyGet<SpotifyArtist>(`/artists/${spotifyId}`);
    const name = artistData.name ?? artistName ?? 'Unknown';

    const { listeners, tags } = await this.lastFmGetArtist(name);

    const genres = tags.length > 0 ? tags : (artistData.genres || []);
    const { x, y } = this.computeCoordinates(genres, spotifyId, listeners);

    let topTracks: Array<{
  id: string;
  name: string;
  preview_url: string | null;
  youtube_id: string | null;  // ← add this
  album_art: string;
  album_name: string;
}> = [];

try {
  // Step 1: Find the artist's exact Deezer ID
  const artistRes = await fetch(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`
  );
  const artistData = await artistRes.json() as { data: { id: number; name: string }[] };
  const deezerId = artistData.data?.[0]?.id;

  if (!deezerId) throw new Error('Artist not found on Deezer');

  // Step 2: Fetch their top tracks directly by artist ID
  const tracksRes = await fetch(
    `https://api.deezer.com/artist/${deezerId}/top?limit=10`
  );
  const tracksData = await tracksRes.json() as DeezerSearchResult;

  topTracks = (tracksData.data ?? []).slice(0, 10).map((t) => ({
    id: String(t.id),
    name: t.title,
    preview_url: t.preview ?? null,
    youtube_id: null,  // ← add this
    album_art: t.album?.cover_medium ?? t.album?.cover ?? '',
    album_name: t.album?.title ?? '',
  }));

  // Step 3: For tracks with no Deezer preview, fetch a YouTube ID
  topTracks = await Promise.all(
    topTracks.map(async (t) => ({
      ...t,
      youtube_id: t.preview_url ? null : await this.fetchYoutubeId(name, t.name),
    }))
  );

  this.logger.log(`Deezer: fetched ${topTracks.length} tracks for ${name}`);
} catch (e) {
  this.logger.error(`Deezer top tracks failed for ${name}: ${e}`);
}
    // ── FIX: Use $set so Mongoose properly overwrites arrays on existing docs ──
    const updatePayload = {
      $set: {
        spotify_id: spotifyId,
        name,
        profile_image: artistData.images?.[0]?.url ?? null,
        genres,
        popularity: artistData.popularity ?? 0,
        followers: listeners,
        preview_url: topTracks[0]?.preview_url ?? null,
        top_track_name: topTracks[0]?.name ?? null,
        top_track_album_art: topTracks[0]?.album_art ?? null,
        topTracks,   // ← array is replaced atomically via $set
        x,
        y,
      },
    };

    const doc = await this.artistModel.findOneAndUpdate(
      { spotify_id: spotifyId },
      updatePayload,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    this.logger.log(`Seeded: ${name} | tracks=${topTracks.length} | pos=(${x}, ${y})`);
    return doc;
  }

  async seedPopularArtists(ids: string[]): Promise<void> {
    this.logger.log(`Seeding ${ids.length} artists...`);
    const results = await Promise.allSettled(ids.map((id) => this.fetchAndSeedArtist(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(`Seeding complete. Success: ${ids.length - failed}, Failed: ${failed}`);
  }

  async searchAndSeed(query: any, limit: any = 20): Promise<ArtistDocument[]> {
    const searchTerm = typeof query === 'object' ? query.query : query;
    const rawLimit = typeof query === 'object' && query.limit != null ? query.limit : limit;

    let cleanLimit = parseInt(String(rawLimit).trim(), 10);
    if (isNaN(cleanLimit) || cleanLimit < 1) cleanLimit = 20;
    else if (cleanLimit > 50) cleanLimit = 50;

    if (!searchTerm || typeof searchTerm !== 'string') {
      this.logger.error(`Invalid search term received: ${JSON.stringify(query)}`);
      throw new Error('The search query must be a non-empty string.');
    }

    this.logger.log(`Searching Spotify for: "${searchTerm}" with limit: ${cleanLimit}`);

    const url = `/search?q=${encodeURIComponent(searchTerm)}&type=artist&market=US`;

    try {
      const data = await this.spotifyGet<SpotifySearchResult>(url);

      if (!data.artists?.items) {
        this.logger.warn(`No artists found for query: "${searchTerm}"`);
        return [];
      }

      const seeded: ArtistDocument[] = [];

      for (const a of data.artists.items) {
        try {
          if (a.id) {
            seeded.push(await this.fetchAndSeedArtist(a.id, a.name));
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          this.logger.warn(`Failed to seed ${a.name}: ${errorMessage}`);
        }
      }

      return seeded;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Spotify Search Failed: ${errorMessage}`);
      throw error;
    }
  }

  private async fetchYoutubeId(artistName: string, trackName: string): Promise<string | null> {
  const apiKey = this.config.get<string>('YOUTUBE_API_KEY');
  if (!apiKey) return null;

  try {
    const q = encodeURIComponent(`${artistName} ${trackName}`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=1&key=${apiKey}`
    );
    const data = await res.json() as { items: { id: { videoId: string } }[] };
    return data.items?.[0]?.id?.videoId ?? null;
  } catch {
    return null;
  }
}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: { total: number };
  images: { url: string; width: number; height: number }[];
}

interface SpotifyTopTracks {
  tracks: {
    id: string;
    name: string;
    preview_url: string | null;
    album: { name: string; images: { url: string }[] };
  }[];
}

interface SpotifySearchResult {
  artists: {
    items: SpotifyArtist[];
  };
}

interface LastFmArtistResponse {
  artist?: {
    stats?: {
      listeners?: string;
      playcount?: string;
    };
    tags?: {
      tag: { name: string }[];
    };
  };
}

interface DeezerSearchResult {
  data: {
    id: number;
    title: string;
    preview: string;
    album: {
      title: string;
      cover: string;
      cover_medium: string;
    };
  }[];
}