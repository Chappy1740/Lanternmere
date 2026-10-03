'use client';

import { useActionState } from 'react';
import {
  addArtisanOffering,
  createCraftingRequest,
  deleteArtisanOffering,
  deleteCraftingRequest,
  saveSupplyGoal,
  setCraftingRequestStatus,
  type ArtisanState,
} from '@/app/(app)/artisan-hall/actions';

const initialState: ArtisanState = { message: '', error: false };

function Result({ state }: { state: ArtisanState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.error ? 'alert' : 'status'}
      className={state.error ? 'text-sm text-amber-200' : 'text-text-muted text-sm'}
    >
      {state.message}
    </p>
  );
}

export function ArtisanOfferingForm({
  guildId,
  characters,
}: {
  guildId: string;
  characters: { id: string; character_name: string; realm_slug: string }[];
}) {
  const [state, action, pending] = useActionState(addArtisanOffering, initialState);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="text-text-muted grid gap-1 text-sm">
        Your Traveler
        <select name="characterId" required className="lodge-field px-3 py-2" defaultValue="">
          <option value="" disabled>
            Choose a Traveler
          </option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.character_name} · {character.realm_slug}
            </option>
          ))}
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Profession
        <input
          name="profession"
          required
          maxLength={60}
          className="lodge-field px-3 py-2"
          placeholder="Alchemy"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Specialization (optional)
        <input name="specialization" maxLength={80} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Notable recipe (optional)
        <input name="recipeName" maxLength={120} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Crafting details (optional)
        <textarea name="serviceNote" maxLength={500} className="lodge-field min-h-20 px-3 py-2" />
      </label>
      <p className="text-text-muted text-sm sm:col-span-2">
        Posting shares this Traveler and your player-entered capability with members of this
        verified Guild. It does not prove recipe ownership or current inventory.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending || characters.length === 0} className="lodge-button px-4 py-2">
          {pending ? 'Posting…' : 'Post capability'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function OfferingDeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteArtisanOffering, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-sm text-amber-200 hover:underline">
        {pending ? 'Removing…' : 'Remove my capability'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function CraftingRequestForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(createCraftingRequest, initialState);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="text-text-muted grid gap-1 text-sm">
        Request type
        <select name="requestKind" className="lodge-field px-3 py-2">
          <option value="craft">Crafted item</option>
          <option value="consumable">Consumable</option>
          <option value="material">Material</option>
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Quantity
        <input
          name="quantity"
          type="number"
          min={1}
          max={1000000}
          defaultValue={1}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Item or service
        <input name="itemName" required maxLength={120} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Details (optional)
        <textarea name="details" maxLength={1000} className="lodge-field min-h-20 px-3 py-2" />
      </label>
      <p className="text-text-muted text-sm sm:col-span-2">
        Your game nickname and request will be visible to members of this verified Guild.
        Volunteering also shares the volunteer&apos;s game nickname.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="lodge-button px-4 py-2">
          {pending ? 'Sharing…' : 'Share request'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RequestStatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: 'in_progress' | 'open' | 'completed' | 'cancelled';
  label: string;
}) {
  const [state, action, pending] = useActionState(setCraftingRequestStatus, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button disabled={pending} className="lodge-button-secondary px-3 py-1 text-sm">
        {pending ? 'Saving…' : label}
      </button>
      <Result state={state} />
    </form>
  );
}

export function RequestDeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteCraftingRequest, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-sm text-amber-200 hover:underline">
        {pending ? 'Removing…' : 'Remove request'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function SupplyGoalForm({
  guildId,
  goal,
}: {
  guildId: string;
  goal?: {
    id: string;
    item_name: string;
    target_quantity: number;
    current_quantity: number;
    note: string;
    active: boolean;
  };
}) {
  const [state, action, pending] = useActionState(saveSupplyGoal, initialState);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="id" value={goal?.id ?? ''} />
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Supply item
        <input
          name="itemName"
          required
          maxLength={120}
          defaultValue={goal?.item_name ?? ''}
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Target quantity
        <input
          name="targetQuantity"
          type="number"
          min={1}
          max={1000000}
          required
          defaultValue={goal?.target_quantity ?? 1}
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Manually recorded progress
        <input
          name="currentQuantity"
          type="number"
          min={0}
          max={1000000}
          required
          defaultValue={goal?.current_quantity ?? 0}
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Planning note (optional)
        <textarea
          name="note"
          maxLength={500}
          defaultValue={goal?.note ?? ''}
          className="lodge-field min-h-20 px-3 py-2"
        />
      </label>
      <label className="text-text-muted flex items-center gap-2 text-sm sm:col-span-2">
        <input type="hidden" name="active" value="false" />
        <input name="active" type="checkbox" value="true" defaultChecked={goal?.active ?? true} />
        Active goal
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="lodge-button-secondary px-4 py-2">
          {pending ? 'Saving…' : goal ? 'Update goal' : 'Add goal'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
