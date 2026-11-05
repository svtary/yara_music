import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  CatalogDetailQuery,
  AlbumDetail,
  ArtistDetail,
  RecordingDetail,
} from '@yara/application';

import { AlbumDetailDto, ArtistDetailDto, RecordingDetailDto } from './catalog.dto.js';
import { CATALOG_DETAIL_QUERY } from './tokens.js';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  public constructor(
    @Inject(CATALOG_DETAIL_QUERY) private readonly catalogDetail: CatalogDetailQuery,
  ) {}

  @Get('artists/:id')
  @ApiOperation({ summary: 'Read canonical Artist detail' })
  @ApiOkResponse({ type: ArtistDetailDto })
  @ApiNotFoundResponse({ description: 'Artist not found' })
  public async artist(@Param('id') id: string): Promise<ArtistDetail> {
    const detail = await this.catalogDetail.getArtist(id);
    if (!detail) throw new NotFoundException('Artist not found.');
    return detail;
  }

  @Get('albums/:id')
  @ApiOperation({ summary: 'Read canonical Album detail with ordered recordings' })
  @ApiOkResponse({ type: AlbumDetailDto })
  @ApiNotFoundResponse({ description: 'Album not found' })
  public async album(@Param('id') id: string): Promise<AlbumDetail> {
    const detail = await this.catalogDetail.getAlbum(id);
    if (!detail) throw new NotFoundException('Album not found.');
    return detail;
  }

  @Get('recordings/:id')
  @ApiOperation({ summary: 'Read canonical Recording detail and Album contexts' })
  @ApiOkResponse({ type: RecordingDetailDto })
  @ApiNotFoundResponse({ description: 'Recording not found' })
  public async recording(@Param('id') id: string): Promise<RecordingDetail> {
    const detail = await this.catalogDetail.getRecording(id);
    if (!detail) throw new NotFoundException('Recording not found.');
    return detail;
  }
}
