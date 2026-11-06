import { ApiProperty } from '@nestjs/swagger';

export class CatalogImageDto {
  @ApiProperty({ format: 'uri' })
  public url!: string;

  @ApiProperty({ required: false })
  public provider?: string;

  @ApiProperty({ required: false })
  public sourceRef?: string;
}

export class ArtistSummaryDto {
  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public name!: string;
}

export class AlbumContextSummaryDto {
  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public cover?: CatalogImageDto;
}

export class ArtistSearchResultDto {
  @ApiProperty({ enum: ['artist'] })
  public kind!: 'artist';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public image?: CatalogImageDto;
}

export class AlbumSearchResultDto {
  @ApiProperty({ enum: ['album'] })
  public kind!: 'album';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: [ArtistSummaryDto] })
  public artists!: ArtistSummaryDto[];

  @ApiProperty({ required: false, type: Number })
  public originalReleaseYear?: number;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public cover?: CatalogImageDto;
}

export class RecordingSearchResultDto {
  @ApiProperty({ enum: ['recording'] })
  public kind!: 'recording';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: [ArtistSummaryDto] })
  public artists!: ArtistSummaryDto[];

  @ApiProperty({ required: false, type: Number })
  public durationMs?: number;

  @ApiProperty({ required: false, type: AlbumContextSummaryDto })
  public albumContext?: AlbumContextSummaryDto;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public artwork?: CatalogImageDto;
}

export class ArtistDetailDto {
  @ApiProperty({ enum: ['artist'] })
  public kind!: 'artist';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public canonicalName!: string;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public image?: CatalogImageDto;
}

export class RecordingDetailSummaryDto {
  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: [ArtistSummaryDto] })
  public artists!: ArtistSummaryDto[];

  @ApiProperty({ required: false, type: Number })
  public durationMs?: number;

  @ApiProperty({ type: Number })
  public position!: number;
}

export class AlbumDetailDto {
  @ApiProperty({ enum: ['album'] })
  public kind!: 'album';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: [ArtistSummaryDto] })
  public artists!: ArtistSummaryDto[];

  @ApiProperty({ required: false, type: Number })
  public originalReleaseYear?: number;

  @ApiProperty({ required: false, type: CatalogImageDto })
  public cover?: CatalogImageDto;

  @ApiProperty({ type: Number })
  public trackCount!: number;

  @ApiProperty({ type: [RecordingDetailSummaryDto] })
  public recordings!: RecordingDetailSummaryDto[];
}

export class RecordingDetailDto {
  @ApiProperty({ enum: ['recording'] })
  public kind!: 'recording';

  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ type: [ArtistSummaryDto] })
  public artists!: ArtistSummaryDto[];

  @ApiProperty({ required: false, type: Number })
  public durationMs?: number;

  @ApiProperty({ type: [AlbumContextSummaryDto] })
  public albumContexts!: AlbumContextSummaryDto[];
}
