import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ArtistDocument = Artist & Document;

// ── Track subdocument ─────────────────────────────────────────────────────────
@Schema({ _id: false })
class Track {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) preview_url!: string | null;
  @Prop({ default: '' })    album_art!: string;
  @Prop({ default: '' })    album_name!: string;
  @Prop({ type: String, default: null }) youtube_id!: string | null; // ← add this
}
const TrackSchema = SchemaFactory.createForClass(Track);

/**
 * The Artist schema stores Spotify metadata plus computed (x, y) coordinates.
 *
 * Coordinate Algorithm:
 *   r (radius)  = 100 - popularity          → popular artists near center (0,0)
 *   θ (angle)   = genre_hash(genres) * 2π   → genre determines angular position
 *   x           = r * cos(θ)
 *   y           = r * sin(θ)
 *
 * MongoDB 2dsphere index on `location` enables efficient bounding-box queries.
 */
@Schema({ timestamps: true, collection: 'artists' })
export class Artist {
  // ── Spotify identity ──────────────────────────────────────────────────
  @Prop({ required: true, unique: true, index: true })
  spotify_id!: string;

  // Properly typed subdocument array so Mongoose tracks changes correctly
  @Prop({ type: [TrackSchema], default: [] })
  topTracks!: Track[];

  @Prop({ required: true })
  name!: string;

  @Prop()
  profile_image!: string;

  @Prop()
  banner_image!: string;

  @Prop({ type: [String], default: [] })
  genres!: string[];

  @Prop({ default: 0, min: 0, max: 100 })
  popularity!: number;

  @Prop({ default: 0 })
  followers!: number;

  @Prop({ default: false })
  is_verified!: boolean;

  // ── Top track preview (legacy, kept for compatibility) ────────────────
  @Prop()
  preview_url!: string;

  @Prop()
  top_track_name!: string;

  @Prop()
  top_track_album_art!: string;

  // ── Spatial coordinates ───────────────────────────────────────────────
  @Prop({ required: true })
  x!: number;

  @Prop({ required: true })
  y!: number;
}

export const ArtistSchema = SchemaFactory.createForClass(Artist);

// Flat 2d index on x,y for simple Cartesian bounding-box queries
ArtistSchema.index({ x: 1, y: 1 });