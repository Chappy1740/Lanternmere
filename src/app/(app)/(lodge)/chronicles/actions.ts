'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ChronicleState = { error: string | null; success: string | null };

const chronicleInputSchema = z.object({
  lodgeId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5_000),
});
const chronicleIdSchema = z.uuid();
const chronicleMediaIdSchema = z.uuid();
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function chronicleInput(formData: FormData) {
  return chronicleInputSchema.safeParse({
    lodgeId: formData.get('lodgeId'),
    title: formData.get('title'),
    body: formData.get('body'),
  });
}

function chronicleMediaInput(formData: FormData) {
  const file = formData.get('image');
  const caption = z
    .string()
    .trim()
    .max(500)
    .safeParse(formData.get('caption') ?? '');
  if (!caption.success) return null;
  if (!(file instanceof File) || file.size === 0)
    return caption.data ? null : { file: null, caption: null };
  if (file.size > 5 * 1024 * 1024 || !acceptedImageTypes.has(file.type)) return null;
  return { file, caption: caption.data || null };
}

async function authenticatedClient() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return error || !user ? null : { supabase, user };
  } catch {
    return null;
  }
}

async function isLodgeAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('lodge_members')
    .select('role')
    .eq('lodge_id', lodgeId)
    .eq('profile_id', userId)
    .maybeSingle();
  return !error && (data?.role === 'owner' || data?.role === 'caretaker');
}

async function isLodgeMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('lodge_members')
    .select('lodge_id')
    .eq('lodge_id', lodgeId)
    .eq('profile_id', userId)
    .maybeSingle();
  return !error && Boolean(data);
}

function refreshChronicleViews() {
  revalidatePath('/chronicles');
  revalidatePath('/chronicles/[id]', 'page');
  revalidatePath('/hearth');
}

async function addChronicleMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: { id: string; lodge_id: string },
  userId: string,
  media: { file: File | null; caption: string | null },
) {
  if (!media.file) return true;
  const extension = media.file.type === 'image/jpeg' ? 'jpg' : media.file.type.split('/')[1];
  const storagePath = `${entry.lodge_id}/${entry.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('chronicle-media')
    .upload(storagePath, media.file, { contentType: media.file.type, upsert: false });
  if (uploadError) return false;
  const { error: mediaError } = await supabase.from('chronicle_media').insert({
    chronicle_id: entry.id,
    lodge_id: entry.lodge_id,
    uploaded_by: userId,
    storage_path: storagePath,
    caption: media.caption,
  });
  if (!mediaError) return true;
  await supabase.storage.from('chronicle-media').remove([storagePath]);
  return false;
}

export async function createChronicle(
  _previousState: ChronicleState,
  formData: FormData,
): Promise<ChronicleState> {
  const parsed = chronicleInput(formData);
  const media = chronicleMediaInput(formData);
  if (!parsed.success)
    return { error: 'Give this Chronicle a title and story, then try again.', success: null };
  if (!media)
    return {
      error:
        'Choose a JPG, PNG, or WebP image under 5 MB, with a caption only when attaching an image.',
      success: null,
    };
  let destination = '';
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before writing a Chronicle.', success: null };
    if (!(await isLodgeMember(session.supabase, parsed.data.lodgeId, session.user.id)))
      return { error: 'You do not have access to this Lodge.', success: null };
    const { data, error } = await session.supabase
      .from('chronicle_entries')
      .insert({
        lodge_id: parsed.data.lodgeId,
        author_id: session.user.id,
        title: parsed.data.title,
        body: parsed.data.body,
      })
      .select('id')
      .single();
    if (error || !data)
      return { error: 'The Chronicle could not be saved. Please try again.', success: null };
    if (
      !(await addChronicleMedia(
        session.supabase,
        { ...data, lodge_id: parsed.data.lodgeId },
        session.user.id,
        media,
      ))
    ) {
      await session.supabase.from('chronicle_entries').delete().eq('id', data.id);
      return { error: 'The Chronicle image could not be saved. Please try again.', success: null };
    }
    refreshChronicleViews();
    destination = `/chronicles/${data.id}?lodge=${parsed.data.lodgeId}`;
  } catch {
    return { error: 'The Chronicle could not be saved. Please try again.', success: null };
  }
  redirect(destination);
}

export async function updateChronicle(
  _previousState: ChronicleState,
  formData: FormData,
): Promise<ChronicleState> {
  const parsed = chronicleInput(formData);
  const media = chronicleMediaInput(formData);
  const chronicleId = chronicleIdSchema.safeParse(formData.get('chronicleId'));
  if (!parsed.success || !chronicleId.success)
    return { error: 'Check the Chronicle details and try again.', success: null };
  if (!media)
    return {
      error:
        'Choose a JPG, PNG, or WebP image under 5 MB, with a caption only when attaching an image.',
      success: null,
    };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before editing a Chronicle.', success: null };
    const { data: entry, error: readError } = await session.supabase
      .from('chronicle_entries')
      .select('id, lodge_id, author_id')
      .eq('id', chronicleId.data)
      .maybeSingle();
    const permitted =
      entry &&
      (entry.author_id === session.user.id ||
        (await isLodgeAdmin(session.supabase, entry.lodge_id, session.user.id)));
    if (readError || !permitted || entry.lodge_id !== parsed.data.lodgeId)
      return { error: 'You do not have permission to edit this Chronicle.', success: null };
    const { error } = await session.supabase
      .from('chronicle_entries')
      .update({ title: parsed.data.title, body: parsed.data.body })
      .eq('id', entry.id);
    if (error)
      return { error: 'The Chronicle could not be updated. Please try again.', success: null };
    if (!(await addChronicleMedia(session.supabase, entry, session.user.id, media)))
      return {
        error: 'The Chronicle was updated, but the image could not be saved. Please try again.',
        success: null,
      };
    refreshChronicleViews();
    return { error: null, success: 'Chronicle updated.' };
  } catch {
    return { error: 'The Chronicle could not be updated. Please try again.', success: null };
  }
}

export async function deleteChronicle(
  _previousState: ChronicleState,
  formData: FormData,
): Promise<ChronicleState> {
  const chronicleId = chronicleIdSchema.safeParse(formData.get('chronicleId'));
  if (!chronicleId.success) return { error: 'Choose a valid Chronicle.', success: null };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before removing a Chronicle.', success: null };
    const { data: entry, error: readError } = await session.supabase
      .from('chronicle_entries')
      .select('id, lodge_id, author_id')
      .eq('id', chronicleId.data)
      .maybeSingle();
    const permitted =
      entry &&
      (entry.author_id === session.user.id ||
        (await isLodgeAdmin(session.supabase, entry.lodge_id, session.user.id)));
    if (readError || !permitted)
      return { error: 'You do not have permission to remove this Chronicle.', success: null };
    const { data: media, error: mediaReadError } = await session.supabase
      .from('chronicle_media')
      .select('storage_path')
      .eq('chronicle_id', entry.id);
    if (mediaReadError)
      return { error: 'The Chronicle could not be removed. Please try again.', success: null };
    if (media.length > 0) {
      const { error: storageError } = await session.supabase.storage
        .from('chronicle-media')
        .remove(media.map((item) => item.storage_path));
      if (storageError)
        return {
          error: 'The Chronicle images could not be removed. Please try again.',
          success: null,
        };
    }
    const { error } = await session.supabase.from('chronicle_entries').delete().eq('id', entry.id);
    if (error)
      return { error: 'The Chronicle could not be removed. Please try again.', success: null };
    refreshChronicleViews();
    return { error: null, success: 'Chronicle removed.' };
  } catch {
    return { error: 'The Chronicle could not be removed. Please try again.', success: null };
  }
}

export async function deleteChronicleMedia(
  _previousState: ChronicleState,
  formData: FormData,
): Promise<ChronicleState> {
  const mediaId = chronicleMediaIdSchema.safeParse(formData.get('mediaId'));
  if (!mediaId.success) return { error: 'Choose a valid Chronicle image.', success: null };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before removing an image.', success: null };
    const { data: media, error: readError } = await session.supabase
      .from('chronicle_media')
      .select('id, chronicle_id, lodge_id, uploaded_by, storage_path')
      .eq('id', mediaId.data)
      .maybeSingle();
    const { data: entry, error: entryError } = media
      ? await session.supabase
          .from('chronicle_entries')
          .select('author_id')
          .eq('id', media.chronicle_id)
          .maybeSingle()
      : { data: null, error: null };
    const permitted =
      media &&
      (media.uploaded_by === session.user.id ||
        entry?.author_id === session.user.id ||
        (await isLodgeAdmin(session.supabase, media.lodge_id, session.user.id)));
    if (readError || entryError || !permitted)
      return { error: 'You do not have permission to remove this image.', success: null };
    const { error: storageError } = await session.supabase.storage
      .from('chronicle-media')
      .remove([media.storage_path]);
    if (storageError)
      return { error: 'The image could not be removed. Please try again.', success: null };
    const { error } = await session.supabase.from('chronicle_media').delete().eq('id', media.id);
    if (error) return { error: 'The image could not be removed. Please try again.', success: null };
    refreshChronicleViews();
    return { error: null, success: 'Chronicle image removed.' };
  } catch {
    return { error: 'The image could not be removed. Please try again.', success: null };
  }
}
