import { describe, expect, it } from 'vitest';

import {
  albumId,
  albumRef,
  artistId,
  artistRef,
  createProviderIdentity,
  createProviderMapping,
  providerMappingSourceRef,
  recordingId,
  recordingRef,
  type ProviderMappingInput,
} from './index.js';

describe('ProviderMapping', () => {
  const providerIdentity = createProviderIdentity({
    provider: 'musicbrainz',
    externalObjectType: 'release-group',
    externalId: 'provider-release-group-42',
  });
  const provenance = { sourceRef: providerMappingSourceRef('observation-1') };

  it('maps provider taxonomy independently to a typed canonical Album reference', () => {
    const canonicalRef = albumRef(albumId('album-42'));
    const mapping = createProviderMapping({
      providerIdentity,
      canonicalKind: 'album',
      status: 'resolved',
      canonicalRef,
      mappingVersion: 1,
      provenance,
    });

    expect(mapping.providerIdentity.externalObjectType).toBe('release-group');
    expect(mapping.canonicalKind).toBe('album');
    expect(mapping.status).toBe('resolved');
    if (mapping.status === 'resolved') expect(mapping.canonicalRef).toEqual(canonicalRef);
  });

  it('preserves unresolved and ambiguous mapping semantics with an explicit target kind', () => {
    const unresolved = createProviderMapping({
      providerIdentity,
      canonicalKind: 'album',
      status: 'unresolved',
      mappingVersion: 1,
      provenance,
    });
    const ambiguous = createProviderMapping({
      providerIdentity,
      canonicalKind: 'album',
      status: 'ambiguous',
      candidateRefs: [albumRef(albumId('album-1')), albumRef(albumId('album-2'))],
      mappingVersion: 2,
      provenance,
    });

    expect(unresolved.status).toBe('unresolved');
    expect(ambiguous.status).toBe('ambiguous');
  });

  it('rejects canonical type mismatches, candidate mismatches, malformed states, and invalid versions', () => {
    expect(() =>
      createProviderMapping({
        providerIdentity,
        canonicalKind: 'album',
        status: 'resolved',
        canonicalRef: recordingRef(recordingId('recording-1')),
        mappingVersion: 1,
        provenance,
      }),
    ).toThrowError(/cannot reference recording/);

    expect(() =>
      createProviderMapping({
        providerIdentity,
        canonicalKind: 'album',
        status: 'ambiguous',
        candidateRefs: [albumRef(albumId('album-1')), artistRef(artistId('artist-1'))],
        mappingVersion: 1,
        provenance,
      }),
    ).toThrowError(/cannot reference artist/);

    expect(() =>
      createProviderMapping({
        providerIdentity,
        canonicalKind: 'album',
        status: 'ambiguous',
        candidateRefs: [albumRef(albumId('album-1'))],
        mappingVersion: 1,
        provenance,
      } as unknown as ProviderMappingInput),
    ).toThrowError(/at least 2/);

    expect(() =>
      createProviderMapping({
        providerIdentity,
        canonicalKind: 'album',
        status: 'unresolved',
        mappingVersion: 0,
        provenance,
      }),
    ).toThrowError(/positive safe integer/);
  });
});
