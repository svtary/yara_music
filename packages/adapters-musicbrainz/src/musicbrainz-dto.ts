import { z } from 'zod';

const musicBrainzId = z.string().uuid();

export const musicBrainzArtistDtoSchema = z
  .object({
    id: musicBrainzId,
    name: z.string().min(1),
  })
  .passthrough();

const artistCreditSchema = z
  .object({
    artist: musicBrainzArtistDtoSchema,
  })
  .passthrough();

const embeddedRecordingSchema = z
  .object({
    id: musicBrainzId,
    title: z.string().min(1),
    length: z.number().int().positive().nullable().optional(),
    'artist-credit': z.array(artistCreditSchema).optional(),
  })
  .passthrough();

const releaseTrackSchema = z
  .object({
    recording: embeddedRecordingSchema,
  })
  .passthrough();

const releaseMediumSchema = z
  .object({
    tracks: z.array(releaseTrackSchema).optional(),
  })
  .passthrough();

export const musicBrainzReleaseDtoSchema = z
  .object({
    id: musicBrainzId,
    date: z.string().optional(),
    status: z.string().optional(),
    media: z.array(releaseMediumSchema).optional(),
  })
  .passthrough();

export const musicBrainzReleaseGroupDtoSchema = z
  .object({
    id: musicBrainzId,
    title: z.string().min(1),
    'first-release-date': z.string().optional(),
    'artist-credit': z.array(artistCreditSchema).optional(),
    releases: z.array(musicBrainzReleaseDtoSchema).optional(),
  })
  .passthrough();

const recordingReleaseSchema = z
  .object({
    id: musicBrainzId,
    title: z.string().min(1),
    'release-group': z
      .object({ id: musicBrainzId, title: z.string().min(1) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const musicBrainzRecordingDtoSchema = z
  .object({
    id: musicBrainzId,
    title: z.string().min(1),
    length: z.number().int().positive().nullable().optional(),
    'artist-credit': z.array(artistCreditSchema).optional(),
    releases: z.array(recordingReleaseSchema).optional(),
  })
  .passthrough();

export type MusicBrainzArtistDto = z.infer<typeof musicBrainzArtistDtoSchema>;
export type MusicBrainzReleaseDto = z.infer<typeof musicBrainzReleaseDtoSchema>;
export type MusicBrainzReleaseGroupDto = z.infer<typeof musicBrainzReleaseGroupDtoSchema>;
export type MusicBrainzRecordingDto = z.infer<typeof musicBrainzRecordingDtoSchema>;

export const coverArtArchiveDtoSchema = z
  .object({
    images: z.array(
      z
        .object({
          id: z.union([z.string(), z.number()]).transform(String),
          image: z.string().url(),
          front: z.boolean().optional(),
          approved: z.boolean().optional(),
          thumbnails: z
            .object({
              '250': z.string().url().optional(),
              '500': z.string().url().optional(),
              '1200': z.string().url().optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type CoverArtArchiveDto = z.infer<typeof coverArtArchiveDtoSchema>;
