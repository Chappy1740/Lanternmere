'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fetchRaiderIoProgress } from '@/lib/raiderio';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type CharacterStatusState = {
  error: string | null;
  success: string | null;
};

export async function removeTraveler(
  _previous: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const parsed = z.object({ characterId: z.uuid(), confirm: z.literal('on') }).safeParse({
    characterId: formData.get('characterId'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: 'Confirm removal of this Traveler.', success: null };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Sign in before removing a Traveler.', success: null };
    const { data, error } = await supabase.rpc('remove_owned_traveler', {
      p_character_id: parsed.data.characterId,
    });
    if (error || data !== parsed.data.characterId)
      return { error: 'Only your own Traveler can be removed. Please try again.', success: null };
  } catch {
    return { error: 'Removal could not be completed. Please try again.', success: null };
  }
  revalidatePath('/', 'layout');
  redirect('/travelers?removed=1');
}

const raidbotsReportSchema = z.object({
  characterId: z.uuid(),
  lodgeId: z.uuid(),
  reportUrl: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        (url.hostname === 'raidbots.com' || url.hostname === 'www.raidbots.com')
      );
    }, 'Use a Raidbots report link.'),
  upgradeTargets: z.string().trim().max(500).optional(),
});

export async function saveRaidbotsReport(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const parsed = raidbotsReportSchema.safeParse({
    characterId: formData.get('characterId'),
    lodgeId: formData.get('lodgeId'),
    reportUrl: formData.get('reportUrl'),
    upgradeTargets: formData.get('upgradeTargets') || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the report details.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in before sharing a Raidbots report.', success: null };
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id, character_name, realm_slug, region')
    .eq('id', parsed.data.characterId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (characterError || !character)
    return { error: 'You can only share a report for your own Traveler.', success: null };
  const { error } = await supabase.from('character_raidbots_reports').upsert({
    character_id: character.id,
    lodge_id: parsed.data.lodgeId,
    character_name: character.character_name,
    realm_slug: character.realm_slug,
    region: character.region,
    report_url: parsed.data.reportUrl,
    upgrade_targets: parsed.data.upgradeTargets || null,
  });
  if (error)
    return {
      error: 'Unable to save the Raidbots report. Check your Lodge access and try again.',
      success: null,
    };
  revalidatePath(`/travelers/${character.id}`);
  revalidatePath('/adventures');
  return { error: null, success: 'Raidbots report shared with this Lodge.' };
}

export async function removeRaidbotsReport(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const characterId = z.uuid().safeParse(formData.get('characterId'));
  const lodgeId = z.uuid().safeParse(formData.get('lodgeId'));
  if (!characterId.success || !lodgeId.success)
    return { error: 'Choose a valid report.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in before removing a report.', success: null };
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId.data)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!character)
    return { error: 'You can only remove reports for your own Traveler.', success: null };
  const { error } = await supabase
    .from('character_raidbots_reports')
    .delete()
    .eq('character_id', character.id)
    .eq('lodge_id', lodgeId.data);
  if (error)
    return { error: 'Unable to remove the Raidbots report. Please try again.', success: null };
  revalidatePath(`/travelers/${character.id}`);
  revalidatePath('/adventures');
  return { error: null, success: 'Raidbots report removed from this Lodge.' };
}

export async function refreshRaiderIo(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const characterId = z.uuid().safeParse(formData.get('characterId'));
  if (!characterId.success) return { error: 'Choose a valid character.', success: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: 'Please sign in before refreshing Raider.IO progress.', success: null };

  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id, character_name, realm_slug, region')
    .eq('id', characterId.data)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (characterError || !character)
    return { error: 'You can only refresh your own Traveler.', success: null };

  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc('claim_raiderio_refresh', {
    p_character_id: character.id,
  });
  if (claimError)
    return { error: 'Unable to check Raider.IO freshness. Please try again.', success: null };
  if (!claimed)
    return { error: 'Raider.IO progress can be refreshed once every 24 hours.', success: null };

  const result = await fetchRaiderIoProgress({
    region: character.region,
    realm: character.realm_slug,
    characterName: character.character_name,
  });
  if (!result.ok) {
    await admin
      .from('character_raiderio_refresh_attempts')
      .update({ failure_message: result.message })
      .eq('character_id', character.id);
    await admin
      .from('character_raiderio_snapshots')
      .update({ failure_message: result.message })
      .eq('character_id', character.id);
    revalidatePath(`/travelers/${character.id}`);
    revalidatePath('/adventures');
    return { error: result.message, success: null };
  }

  const { error: saveError } = await admin.from('character_raiderio_snapshots').upsert({
    character_id: character.id,
    character_name: character.character_name,
    realm_slug: character.realm_slug,
    region: character.region,
    mythic_plus_score: result.score,
    season_label: result.seasonLabel,
    best_runs: result.bestRuns,
    raid_progression: result.raidProgression,
    source_url: result.sourceUrl,
    refreshed_at: new Date().toISOString(),
    failure_message: null,
  });
  if (saveError) {
    await admin
      .from('character_raiderio_refresh_attempts')
      .update({ failure_message: 'Raider.IO progress could not be saved.' })
      .eq('character_id', character.id);
    revalidatePath('/adventures');
    return { error: 'Raider.IO progress could not be saved. Please try again.', success: null };
  }

  revalidatePath(`/travelers/${character.id}`);
  revalidatePath('/adventures');
  return {
    error: null,
    success: 'Raider.IO progress refreshed. Shared Lodges can now see the latest snapshot.',
  };
}

export async function updateRaiderIoSharing(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const characterId = z.uuid().safeParse(formData.get('characterId'));
  const lodgeId = z.uuid().safeParse(formData.get('lodgeId'));
  const enabled = formData.get('enabled') === 'true';
  if (!characterId.success || !lodgeId.success)
    return { error: 'Choose a valid character and Lodge.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in before changing Raider.IO sharing.', success: null };
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId.data)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!character)
    return { error: 'You can only change sharing for your own Traveler.', success: null };
  const result = enabled
    ? await supabase
        .from('character_raiderio_sharing')
        .upsert({ character_id: characterId.data, lodge_id: lodgeId.data })
    : await supabase
        .from('character_raiderio_sharing')
        .delete()
        .eq('character_id', characterId.data)
        .eq('lodge_id', lodgeId.data);
  if (result.error)
    return {
      error: 'Unable to update Raider.IO sharing. Check your Lodge access and try again.',
      success: null,
    };
  revalidatePath('/travelers/[id]', 'page');
  revalidatePath('/adventures');
  return {
    error: null,
    success: enabled
      ? 'Raider.IO readiness sharing enabled.'
      : 'Raider.IO readiness sharing removed.',
  };
}

export async function makeMainCharacter(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const parsed = z.uuid().safeParse(formData.get('characterId'));

  if (!parsed.success) {
    return { error: 'Choose a valid character.', success: null };
  }

  const characterId = parsed.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: 'Please sign in before choosing your main character.',
        success: null,
      };
    }

    const { data, error } = await supabase.rpc('set_main_character', {
      p_character_id: characterId,
    });

    if (error || data !== characterId) {
      return {
        error: 'Unable to change your main. Choose one of your own saved characters and try again.',
        success: null,
      };
    }
  } catch {
    return {
      error: 'The request could not be completed. Please try again.',
      success: null,
    };
  }

  // Refresh the list and all details, including the previous main.
  revalidatePath('/travelers');
  revalidatePath('/hearth');
  revalidatePath('/travelers/[id]', 'page');

  return {
    error: null,
    success: 'Main character updated. Your previous main is now an Alternate.',
  };
}
