'use client';

import Image from 'next/image';
import { useState } from 'react';
import { isBlizzardPortrait } from '@/lib/wow/portrait';

function fallbackPortrait(characterClass?: string, gender?: string) {
  const classKey = characterClass?.trim().toLowerCase().replaceAll(' ', '-');
  const genderKey = gender?.trim().toLowerCase();
  const genderedClasses = new Set([
    'paladin',
    'hunter',
    'rogue',
    'priest',
    'shaman',
    'mage',
    'warlock',
    'monk',
    'druid',
    'demon-hunter',
    'evoker',
  ]);

  if (classKey && genderedClasses.has(classKey) && (genderKey === 'male' || genderKey === 'female')) {
    return `/brand/lanternmere-${classKey}-${genderKey}-portrait-v1.webp`;
  }

  switch (classKey) {
    case 'warrior':
      return '/brand/lanternmere-warrior-portrait-v1.webp';
    case 'death-knight':
      return '/brand/lanternmere-death-knight-portrait-v1.webp';
    default:
      return undefined;
  }
}

export function CharacterPortrait({
  src,
  name,
  characterClass,
  gender,
}: {
  src?: string;
  name: string;
  characterClass?: string | null;
  gender?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const fallbackSrc = fallbackPortrait(characterClass ?? undefined, gender ?? undefined);
  return (
    <div className="border-[color:var(--border-ornate)] bg-surface-sunken flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)]">
      {src && src !== failedSrc && isBlizzardPortrait(src) ? (
        <Image
          src={src}
          alt={`${name}'s portrait`}
          width={64}
          height={64}
          onError={() => setFailedSrc(src)}
        />
      ) : fallbackSrc ? (
        <Image
          src={fallbackSrc}
          alt={`Illustrated fallback portrait for ${name}`}
          width={64}
          height={64}
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
