import { describe, expect, it } from 'vitest';

import {
  albumId,
  artistId,
  createAlbum,
  createArtist,
  createRecording,
  providerMappingSourceRef,
  providerName,
  recordingId,
} from './index.js';

describe('Catalog model', () => {
  const artist = artistId('artist-1');
  const recording = recordingId('recording-1');
  const sourcedImage = {
    url: 'https://images.example.test/catalog/example.jpg',
    provider: providerName('fixture-metadata'),
    sourceRef: providerMappingSourceRef('fixture:image:1'),
  } as const;

  it('creates immutable Artist, Album, and Recording canonical objects with Stage 1 metadata', () => {
    const canonicalArtist = createArtist({
      id: artist,
      canonicalName: 'Cocteau Twins',
      image: sourcedImage,
    });
    const canonicalRecording = createRecording({
      id: recording,
      canonicalTitle: 'Cherry-coloured Funk',
      artistIds: [artist],
      durationMs: 213_000,
    });
    const canonicalAlbum = createAlbum({
      id: albumId('album-1'),
      canonicalTitle: 'Heaven or Las Vegas',
      artistIds: [artist],
      recordingIds: [recording],
      originalReleaseYear: 1990,
      cover: sourcedImage,
    });

    expect(canonicalArtist.image).toEqual(sourcedImage);
    expect(canonicalRecording.durationMs).toBe(213_000);
    expect(canonicalAlbum.originalReleaseYear).toBe(1990);
    expect(canonicalAlbum.recordingIds).toEqual([recording]);
    expect(Object.isFrozen(canonicalArtist.image)).toBe(true);
    expect(Object.isFrozen(canonicalRecording.artistIds)).toBe(true);
    expect(Object.isFrozen(canonicalAlbum.recordingIds)).toBe(true);
  });

  it('rejects blank text, duplicate references, invalid year, and invalid duration', () => {
    expect(() => createArtist({ id: artist, canonicalName: ' ' })).toThrowError(/canonical name/);
    expect(() =>
      createRecording({
        id: recording,
        canonicalTitle: 'Lorelei',
        artistIds: [artist, artist],
      }),
    ).toThrowError(/duplicate canonical IDs/);
    expect(() =>
      createAlbum({
        id: albumId('album-2'),
        canonicalTitle: 'Treasure',
        artistIds: [artist],
        recordingIds: [recording, recording],
      }),
    ).toThrowError(/duplicate canonical IDs/);
    expect(() =>
      createAlbum({
        id: albumId('album-3'),
        canonicalTitle: 'Treasure',
        artistIds: [artist],
        recordingIds: [recording],
        originalReleaseYear: 999,
      }),
    ).toThrowError(/original release year/);
    expect(() =>
      createRecording({
        id: recording,
        canonicalTitle: 'Lorelei',
        artistIds: [artist],
        durationMs: 0,
      }),
    ).toThrowError(/positive safe integer/);
  });

  it('requires complete image provenance when either provenance field is supplied', () => {
    expect(() =>
      createArtist({
        id: artist,
        canonicalName: 'Cocteau Twins',
        image: {
          url: 'https://images.example.test/artist.jpg',
          provider: providerName('fixture-metadata'),
        },
      }),
    ).toThrowError(/both be present/);
    expect(() =>
      createArtist({
        id: artist,
        canonicalName: 'Cocteau Twins',
        image: { url: 'file:///tmp/artist.jpg' },
      }),
    ).toThrowError(/HTTP/);
  });
});
