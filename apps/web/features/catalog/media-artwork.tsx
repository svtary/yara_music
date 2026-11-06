'use client';

import { useState } from 'react';

interface MediaArtworkProps {
  readonly url: string | undefined;
  readonly alt: string;
  readonly shape?: 'square' | 'circle' | 'landscape';
  readonly className?: string;
}

export function MediaArtwork({ url, alt, shape = 'square', className = '' }: MediaArtworkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <div className={`catalog-artwork is-${shape} ${className}`}>
      {url && failedUrl !== url ? (
        <img src={url} alt={alt} loading="lazy" onError={() => setFailedUrl(url)} />
      ) : (
        <span
          className="catalog-artwork-fallback"
          aria-label={`${alt} artwork unavailable`}
          role="img"
        >
          <span aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
