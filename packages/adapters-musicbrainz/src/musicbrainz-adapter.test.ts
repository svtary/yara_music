import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CoverArtArchiveClient } from './cover-art-client.js';
import { MusicBrainzClient } from './musicbrainz-client.js';
import { MusicBrainzProviderAdapter } from './musicbrainz-provider-adapter.js';
import {
  musicBrainzArtistDtoSchema,
  musicBrainzRecordingDtoSchema,
  musicBrainzReleaseGroupDtoSchema,
} from './musicbrainz-dto.js';
import {
  normalizeMusicBrainzArtist,
  normalizeMusicBrainzRecording,
  normalizeMusicBrainzReleaseGroup,
} from './normalization.js';
import {
  ProviderHttpClient,
  ProviderHttpError,
  ProviderResponseError,
} from './provider-http-client.js';

const artistId = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
const albumId = 'b1392450-e666-3926-a536-22c65f834433';
const recordingId = '10c1a66a-816b-4ff1-9fba-7b3a19c29f96';

const artistDto = { id: artistId, name: 'Radiohead' };
const recordingDto = {
  id: recordingId,
  title: 'Paranoid Android',
  length: 383_000,
  'artist-credit': [{ artist: artistDto }],
};
const albumDto = {
  id: albumId,
  title: 'OK Computer',
  'first-release-date': '1997-05-21',
  'artist-credit': [{ artist: artistDto }],
  releases: [
    {
      id: 'fbd58822-88bb-4e35-90c9-487a578f50f2',
      media: [{ tracks: [{ recording: recordingDto }] }],
    },
  ],
};

describe('MusicBrainz DTO and normalization boundary', () => {
  it('parses independent Artist, release-group, and Recording DTOs', () => {
    expect(musicBrainzArtistDtoSchema.parse(artistDto).name).toBe('Radiohead');
    expect(musicBrainzReleaseGroupDtoSchema.parse(albumDto).title).toBe('OK Computer');
    expect(musicBrainzRecordingDtoSchema.parse(recordingDto).length).toBe(383_000);
  });

  it('normalizes only approved Catalog fields and keeps provider taxonomy typed', () => {
    const artist = normalizeMusicBrainzArtist(musicBrainzArtistDtoSchema.parse(artistDto));
    const recording = normalizeMusicBrainzRecording(
      musicBrainzRecordingDtoSchema.parse(recordingDto),
    );
    const album = normalizeMusicBrainzReleaseGroup(
      musicBrainzReleaseGroupDtoSchema.parse(albumDto),
    );

    expect(artist).toEqual(
      expect.objectContaining({
        canonicalName: 'Radiohead',
        providerIdentity: expect.objectContaining({ externalObjectType: 'artist' }),
      }),
    );
    expect(recording).toEqual(
      expect.objectContaining({ canonicalTitle: 'Paranoid Android', durationMs: 383_000 }),
    );
    expect(album).toEqual(
      expect.objectContaining({
        canonicalTitle: 'OK Computer',
        originalReleaseYear: 1997,
        providerIdentity: expect.objectContaining({ externalObjectType: 'release-group' }),
      }),
    );
    expect(album.recordings).toHaveLength(1);
    expect(album).not.toHaveProperty('label');
    expect(album).not.toHaveProperty('barcode');
  });

  it('loads a release-group tracklist through a representative release without persisting release semantics', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...albumDto,
            releases: [
              {
                id: 'fbd58822-88bb-4e35-90c9-487a578f50f2',
                status: 'Official',
                date: '1997-05-21',
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'fbd58822-88bb-4e35-90c9-487a578f50f2',
            media: [{ tracks: [{ recording: recordingDto }] }],
          }),
          { status: 200 },
        ),
      );
    const client = new MusicBrainzClient({
      baseUrl: 'https://musicbrainz.example/ws/2/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      minimumIntervalMs: 0,
      maximumRetries: 0,
      fetch: fetchMock,
    });
    const result = await client.getReleaseGroup(albumId);
    expect(result?.releases?.[0]?.media?.[0]?.tracks).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('release-group/');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('release/');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('inc=recordings+artist-credits');
  });
});

describe('ProviderHttpClient', () => {
  const schema = z.object({ ok: z.literal(true) });

  it('sends a meaningful User-Agent and paces sequential requests', async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const client = new ProviderHttpClient({
      baseUrl: 'https://provider.example/ws/2/',
      userAgent: 'Yara-MVP-0/0.0.0 (contact@example.test)',
      minimumIntervalMs: 1_000,
      maximumRetries: 0,
      fetch: fetchMock,
      now: () => clock,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        clock += milliseconds;
      },
    });
    await client.getJson('artist/one', schema);
    await client.getJson('artist/two', schema);

    expect(sleeps).toEqual([1_000]);
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.headers).toMatchObject({
      Accept: 'application/json',
      'User-Agent': 'Yara-MVP-0/0.0.0 (contact@example.test)',
    });
  });

  it('treats 404 as absence and fails closed on malformed payloads', async () => {
    const notFound = new ProviderHttpClient({
      baseUrl: 'https://provider.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      maximumRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })),
    });
    await expect(notFound.getJson('missing', schema)).resolves.toBeNull();

    const malformed = new ProviderHttpClient({
      baseUrl: 'https://provider.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      maximumRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 })),
    });
    await expect(malformed.getJson('bad', schema)).rejects.toThrowError(ProviderResponseError);

    const malformedJson = new ProviderHttpClient({
      baseUrl: 'https://provider.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      maximumRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{', { status: 200 })),
    });
    await expect(malformedJson.getJson('invalid-json', schema)).rejects.toThrowError(
      /malformed JSON/u,
    );
  });

  it('bounds transient retries and retries 503 exactly within budget', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const client = new ProviderHttpClient({
      baseUrl: 'https://provider.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      minimumIntervalMs: 0,
      maximumRetries: 2,
      fetch: fetchMock,
      sleep: async () => undefined,
    });
    await expect(client.getJson('busy', schema)).rejects.toThrowError(ProviderHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('turns an explicit timeout into a bounded provider error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const client = new ProviderHttpClient({
      baseUrl: 'https://provider.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      timeoutMs: 5,
      maximumRetries: 0,
      fetch: fetchMock,
    });
    await expect(client.getJson('slow', schema)).rejects.toThrowError(/aborted/u);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('Cover Art Archive degradation', () => {
  it('treats a 404 as no cover', async () => {
    const client = new CoverArtArchiveClient({
      baseUrl: 'https://cover.example/',
      userAgent: 'Yara-Test/1 (contact@example.test)',
      maximumRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })),
    });
    await expect(client.getReleaseGroupCover(albumId)).resolves.toBeUndefined();
  });

  it('does not reject Album normalization when artwork lookup fails', async () => {
    const adapter = new MusicBrainzProviderAdapter(
      { getReleaseGroup: vi.fn().mockResolvedValue(albumDto) } as never,
      { getReleaseGroupCover: vi.fn().mockRejectedValue(new Error('outage')) } as never,
    );
    await expect(adapter.getAlbum(albumId)).resolves.toEqual(
      expect.objectContaining({ canonicalTitle: 'OK Computer' }),
    );
  });
});
