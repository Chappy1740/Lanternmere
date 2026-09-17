'use client';

import Image from 'next/image';
import { useState } from 'react';
import { isBlizzardPortrait } from '@/lib/wow/portrait';

export function CharacterPortrait({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <div className="border-border bg-background flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
      {src && src !== failedSrc && isBlizzardPortrait(src) ? (
        <Image
          src={src}
          alt={`${name}'s portrait`}
          width={64}
          height={64}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          className="font-display text-accent text-2xl"
          role="img"
          aria-label={`${name}: portrait unavailable`}
        >
          {Array.from(name)[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  );
}
