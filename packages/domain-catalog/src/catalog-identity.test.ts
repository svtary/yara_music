import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  albumId,
  artistId,
  createProviderIdentity,
  providerMappingSourceRef,
  recordingId,
  type AlbumId,
  type ArtistId,
  type ProviderExternalId,
  type RecordingId,
} from './index.js';

describe('Catalog canonical identities', () => {
  it('keeps canonical IDs and provider external IDs nominally distinct', () => {
    expectTypeOf<ArtistId>().not.toEqualTypeOf<AlbumId>();
    expectTypeOf<ArtistId>().not.toEqualTypeOf<RecordingId>();
    expectTypeOf<AlbumId>().not.toEqualTypeOf<RecordingId>();
    expectTypeOf<ProviderExternalId>().not.toEqualTypeOf<ArtistId>();

    expect(artistId('canonical-artist-1')).toBe('canonical-artist-1');
    expect(albumId('canonical-album-1')).toBe('canonical-album-1');
    expect(recordingId('canonical-recording-1')).toBe('canonical-recording-1');
  });

  it('keeps provider taxonomy independent from Yara canonical kinds', () => {
    const identity = createProviderIdentity({
      provider: 'musicbrainz',
      externalObjectType: 'release-group',
      externalId: 'provider-release-group-42',
    });

    expect(identity).toEqual({
      provider: 'musicbrainz',
      externalObjectType: 'release-group',
      externalId: 'provider-release-group-42',
    });
  });

  it('rejects malformed opaque identities without selecting a UUID/ULID strategy', () => {
    expect(() => artistId('')).toThrowError(/ArtistId/);
    expect(() => albumId(' album-1')).toThrowError(/AlbumId/);
    expect(() => recordingId('recording\n1')).toThrowError(/RecordingId/);
    expect(() =>
      createProviderIdentity({
        provider: 'musicbrainz',
        externalObjectType: 'release group',
        externalId: 'external-1',
      }),
    ).toThrowError(/external object type/);
    expect(() => providerMappingSourceRef('')).toThrowError(/source reference/);
  });
});
