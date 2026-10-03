'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ArtisanState = { message: string; error: boolean };

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

const offeringInput = z.object({
  guildId: z.uuid(),
  characterId: z.uuid(),
  profession: z.string().trim().min(1).max(60),
  specialization: z.string().trim().max(80),
  recipeName: z.string().trim().max(120),
  serviceNote: z.string().trim().max(500),
});

export async function addArtisanOffering(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = offeringInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the Traveler and crafting details.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to publish a capability.', error: true };
  const { error } = await supabase.rpc('add_guild_artisan_offering', {
    p_guild_id: parsed.data.guildId,
    p_character_id: parsed.data.characterId,
    p_profession: parsed.data.profession,
    p_specialization: parsed.data.specialization,
    p_recipe_name: parsed.data.recipeName,
    p_service_note: parsed.data.serviceNote,
  });
  if (error)
    return {
      message: 'Capability could not be posted. Check Guild access or duplicates.',
      error: true,
    };
  revalidatePath('/artisan-hall');
  return { message: 'Crafting capability posted to this Guild.', error: false };
}

export async function deleteArtisanOffering(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = z.uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { message: 'Capability not found.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to remove a capability.', error: true };
  const { error } = await supabase.rpc('delete_guild_artisan_offering', { p_id: parsed.data });
  if (error) return { message: 'Capability could not be removed.', error: true };
  revalidatePath('/artisan-hall');
  return { message: 'Capability removed.', error: false };
}

const requestInput = z.object({
  guildId: z.uuid(),
  requestKind: z.enum(['craft', 'consumable', 'material']),
  itemName: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(1000000),
  details: z.string().trim().max(1000),
});

export async function createCraftingRequest(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = requestInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the request details.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to create a request.', error: true };
  const { error } = await supabase.rpc('create_guild_crafting_request', {
    p_guild_id: parsed.data.guildId,
    p_request_kind: parsed.data.requestKind,
    p_item_name: parsed.data.itemName,
    p_quantity: parsed.data.quantity,
    p_details: parsed.data.details,
  });
  if (error) return { message: 'Request could not be created.', error: true };
  revalidatePath('/artisan-hall');
  return { message: 'Request shared with this Guild.', error: false };
}

const statusInput = z.object({
  id: z.uuid(),
  status: z.enum(['in_progress', 'open', 'completed', 'cancelled']),
});

export async function setCraftingRequestStatus(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Choose a valid request action.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to update a request.', error: true };
  const { error } = await supabase.rpc('set_guild_crafting_request_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) return { message: 'Request could not be updated with your Guild role.', error: true };
  revalidatePath('/artisan-hall');
  return { message: 'Request status recorded.', error: false };
}

export async function deleteCraftingRequest(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = z.uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { message: 'Request not found.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to remove a request.', error: true };
  const { error } = await supabase.rpc('delete_guild_crafting_request', { p_id: parsed.data });
  if (error) return { message: 'Request could not be removed.', error: true };
  revalidatePath('/artisan-hall');
  return { message: 'Request removed.', error: false };
}

const goalInput = z.object({
  guildId: z.uuid(),
  id: z.union([z.uuid(), z.literal('')]),
  itemName: z.string().trim().min(1).max(120),
  targetQuantity: z.coerce.number().int().min(1).max(1000000),
  currentQuantity: z.coerce.number().int().min(0).max(1000000),
  note: z.string().trim().max(500),
  active: z.enum(['true', 'false']),
});

export async function saveSupplyGoal(
  _previous: ArtisanState,
  formData: FormData,
): Promise<ArtisanState> {
  const parsed = goalInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.currentQuantity > parsed.data.targetQuantity)
    return { message: 'Check the goal and manually entered progress.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to manage a supply goal.', error: true };
  const { error } = await supabase.rpc('save_guild_supply_goal', {
    p_guild_id: parsed.data.guildId,
    p_id: parsed.data.id || null,
    p_item_name: parsed.data.itemName,
    p_target_quantity: parsed.data.targetQuantity,
    p_current_quantity: parsed.data.currentQuantity,
    p_note: parsed.data.note,
    p_active: parsed.data.active === 'true',
  });
  if (error)
    return { message: 'Supply goal could not be saved. Officer access is required.', error: true };
  revalidatePath('/artisan-hall');
  return { message: 'Manual supply goal saved.', error: false };
}
