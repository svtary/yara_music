import { CatalogInvariantError } from './catalog-error.js';
import {
  assertCatalogEntityRef,
  assertCatalogEntityKind,
  assertProviderIdentity,
  providerMappingSourceRef,
  type CatalogEntityRef,
  type CatalogEntityKind,
  type ProviderIdentity,
  type ProviderMappingSourceRef,
} from './catalog-identity.js';

export type ProviderMappingStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'superseded'
  | 'merged'
  | 'split'
  | 'correction_pending';

export interface ProviderMappingProvenance {
  readonly sourceRef: ProviderMappingSourceRef;
}

interface ProviderMappingBase {
  readonly providerIdentity: ProviderIdentity;
  readonly canonicalKind: CatalogEntityKind;
  readonly mappingVersion: number;
  readonly provenance: ProviderMappingProvenance;
}

export type ProviderMapping =
  | (ProviderMappingBase & {
      readonly status: 'resolved' | 'superseded' | 'merged';
      readonly canonicalRef: CatalogEntityRef;
    })
  | (ProviderMappingBase & {
      readonly status: 'unresolved';
    })
  | (ProviderMappingBase & {
      readonly status: 'ambiguous' | 'split';
      readonly candidateRefs: readonly CatalogEntityRef[];
    })
  | (ProviderMappingBase & {
      readonly status: 'correction_pending';
      readonly canonicalRef: CatalogEntityRef;
      readonly candidateRefs: readonly CatalogEntityRef[];
    });

export type ProviderMappingInput = ProviderMapping;

function mappingVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CatalogInvariantError(
      'INVALID_MAPPING_VERSION',
      'Provider mapping version must be a positive safe integer.',
    );
  }
  return value;
}

function provenance(value: ProviderMappingProvenance): ProviderMappingProvenance {
  if (!value || typeof value !== 'object') {
    throw new CatalogInvariantError(
      'INVALID_MAPPING_STATE',
      'Provider mapping provenance is required.',
    );
  }

  return Object.freeze({ sourceRef: providerMappingSourceRef(value.sourceRef) });
}

function validateMatchingReference(
  canonicalKind: CatalogEntityKind,
  reference: CatalogEntityRef,
): CatalogEntityRef {
  assertCatalogEntityRef(reference);
  if (canonicalKind !== reference.kind) {
    throw new CatalogInvariantError(
      'MAPPING_TYPE_MISMATCH',
      `Canonical ${canonicalKind} mapping cannot reference ${reference.kind}.`,
    );
  }
  return Object.freeze({ ...reference });
}

function candidateRefs(
  canonicalKind: CatalogEntityKind,
  values: readonly CatalogEntityRef[] | undefined,
  minimum: number,
): readonly CatalogEntityRef[] {
  if (!Array.isArray(values) || values.length < minimum) {
    throw new CatalogInvariantError(
      'INVALID_MAPPING_STATE',
      `Provider mapping requires at least ${minimum} candidate canonical reference(s).`,
    );
  }

  const seen = new Set<string>();
  const copy = values.map((reference) => {
    const valid = validateMatchingReference(canonicalKind, reference);
    const key = `${valid.kind}:${valid.id}`;
    if (seen.has(key)) {
      throw new CatalogInvariantError(
        'INVALID_MAPPING_STATE',
        'Provider mapping candidates must be unique.',
      );
    }
    seen.add(key);
    return valid;
  });

  return Object.freeze(copy);
}

export function createProviderMapping(input: ProviderMappingInput): ProviderMapping {
  assertProviderIdentity(input.providerIdentity);
  assertCatalogEntityKind(input.canonicalKind);

  const base = {
    providerIdentity: Object.freeze({ ...input.providerIdentity }),
    canonicalKind: input.canonicalKind,
    mappingVersion: mappingVersion(input.mappingVersion),
    provenance: provenance(input.provenance),
  } as const;

  switch (input.status) {
    case 'resolved':
    case 'superseded':
    case 'merged':
      return Object.freeze({
        ...base,
        status: input.status,
        canonicalRef: validateMatchingReference(input.canonicalKind, input.canonicalRef),
      });
    case 'unresolved':
      return Object.freeze({ ...base, status: input.status });
    case 'ambiguous':
    case 'split':
      return Object.freeze({
        ...base,
        status: input.status,
        candidateRefs: candidateRefs(input.canonicalKind, input.candidateRefs, 2),
      });
    case 'correction_pending':
      return Object.freeze({
        ...base,
        status: input.status,
        canonicalRef: validateMatchingReference(input.canonicalKind, input.canonicalRef),
        candidateRefs: candidateRefs(input.canonicalKind, input.candidateRefs, 1),
      });
    default:
      throw new CatalogInvariantError(
        'INVALID_MAPPING_STATE',
        'Unsupported provider mapping state.',
      );
  }
}
