import { z } from 'zod';

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

export const characterInputSchema = z.object({
  region: z
    .string()
    .transform(normalizeText)
    .pipe(z.enum(['us', 'eu', 'kr', 'tw'])),

  realm: z
    .string()
    .transform((value) =>
      normalizeText(value)
        .replace(/['’]/g, '')
        .replace(/\s+/g, '-'),
    )
    .pipe(
      z
        .string()
        .min(1, 'Enter a realm.')
        .regex(
          /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
          'Enter a realm name or realm slug.',
        ),
    ),

  characterName: z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1, 'Enter a character name.')
        .regex(/^\p{L}+$/u, 'Character names must contain only letters.'),
    ),
});

export type CharacterInput = z.infer<typeof characterInputSchema>;