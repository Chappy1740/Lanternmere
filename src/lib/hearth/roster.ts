import 'server-only';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const memberSchema = z.object({
  profile_id: z.uuid(),
  role: z.enum(['owner', 'caretaker', 'member', 'guest']),
  profiles: z.object({ display_name: z.string() }).nullable(),
});
const characterSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  character_snapshots: z.array(z.object({ last_refreshed_at: z.string() })),
});
export async function loadLodgeRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
) {
  try {
    const result = await supabase
      .from('lodge_members')
      .select('profile_id, role, profiles(display_name)', { count: 'exact' })
      .eq('lodge_id', lodgeId)
      .order('joined_at')
      .order('id')
      .limit(6);
    const parsed = z.array(memberSchema).safeParse(result.data);
    if (result.error || !parsed.success || result.count === null)
      return { state: 'error' as const };
    const members = parsed.data;
    const mains = new Map<string, z.infer<typeof characterSchema>>();
    let charactersUnavailable = false;
    if (members.length) {
      try {
        // RLS may expose a character through another Lodge: require THIS sharing row too.
        const characters = await supabase
          .from('characters')
          .select(
            'id, profile_id, character_name, realm_slug, region, games!inner(slug), character_lodges!inner(lodge_id), character_snapshots(last_refreshed_at)',
          )
          .eq('character_lodges.lodge_id', lodgeId)
          .eq('is_main', true)
          .eq('games.slug', 'wow')
          .in(
            'profile_id',
            members.map((member) => member.profile_id),
          )
          .order('last_refreshed_at', { referencedTable: 'character_snapshots', ascending: false })
          .order('created_at', { referencedTable: 'character_snapshots', ascending: false })
          .limit(1, { referencedTable: 'character_snapshots' });
        const checked = z.array(characterSchema).safeParse(characters.data);
        if (characters.error || !checked.success) charactersUnavailable = true;
        else for (const character of checked.data) mains.set(character.profile_id, character);
      } catch {
        charactersUnavailable = true;
      }
    }
    return { state: 'ready' as const, members, total: result.count, mains, charactersUnavailable };
  } catch {
    return { state: 'error' as const };
  }
}
