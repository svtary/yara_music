import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CatalogSearchInputError } from '@yara/application';
import type { CatalogSearchResult, SearchCatalogQuery } from '@yara/application';

import {
  AlbumSearchResultDto,
  ArtistSearchResultDto,
  RecordingSearchResultDto,
} from './catalog.dto.js';
import { SEARCH_CATALOG_QUERY } from './tokens.js';

@ApiTags('catalog')
@ApiExtraModels(ArtistSearchResultDto, AlbumSearchResultDto, RecordingSearchResultDto)
@Controller('search')
export class SearchController {
  public constructor(
    @Inject(SEARCH_CATALOG_QUERY) private readonly searchCatalog: SearchCatalogQuery,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search the local Yara Catalog projection' })
  @ApiQuery({ name: 'q', type: String, minLength: 1, maxLength: 120 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 50 })
  @ApiQuery({ name: 'type', required: false, enum: ['artist', 'album', 'recording'] })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(ArtistSearchResultDto) },
          { $ref: getSchemaPath(AlbumSearchResultDto) },
          { $ref: getSchemaPath(RecordingSearchResultDto) },
        ],
        discriminator: { propertyName: 'kind' },
      },
    },
  })
  public async search(
    @Query('q') query: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('type') kind: string | undefined,
  ): Promise<readonly CatalogSearchResult[]> {
    try {
      return await this.searchCatalog.execute({
        query: query ?? '',
        ...(rawLimit === undefined ? {} : { limit: Number(rawLimit) }),
        ...(kind === undefined ? {} : { kind }),
      });
    } catch (error) {
      if (error instanceof CatalogSearchInputError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
