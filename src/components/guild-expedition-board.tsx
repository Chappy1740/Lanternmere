'use client';

import { useActionState, useRef, type FormEvent } from 'react';
import {
  clearExpeditionInterestScore,
  createExpeditionPost,
  deleteExpeditionPost,
  removeExpeditionInterest,
  saveExpeditionGoal,
  setExpeditionInterest,
  setExpeditionPostStatus,
  type ExpeditionState,
} from '@/app/(app)/expedition-board/actions';

const initialState: ExpeditionState = { message: '', error: false };

function Result({ state }: { state: ExpeditionState }) {
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

export function ExpeditionPostForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(createExpeditionPost, initialState);
  const startRef = useRef<HTMLInputElement>(null);
  const isoRef = useRef<HTMLInputElement>(null);
  function setLocalTime(event: FormEvent<HTMLFormElement>) {
    const value = startRef.current?.value;
    if (!value || !isoRef.current) {
      event.preventDefault();
      return;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      event.preventDefault();
      return;
    }
    isoRef.current.value = date.toISOString();
  }
  return (
    <form action={action} onSubmit={setLocalTime} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="startsAt" ref={isoRef} />
      <label className="text-text-muted grid gap-1 text-sm">
        Dungeon or open key
        <input
          name="dungeon"
          required
          maxLength={120}
          className="lodge-field px-3 py-2"
          placeholder="Any seasonal dungeon"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Start in your local time
        <input ref={startRef} type="datetime-local" required className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Lowest key level
        <input
          name="keyMin"
          type="number"
          min={2}
          max={40}
          defaultValue={2}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Highest key level
        <input
          name="keyMax"
          type="number"
          min={2}
          max={40}
          defaultValue={10}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Tank spots
        <input
          name="tankSlots"
          type="number"
          min={0}
          max={1}
          defaultValue={1}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Healer spots
        <input
          name="healerSlots"
          type="number"
          min={0}
          max={1}
          defaultValue={1}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Damage spots
        <input
          name="damageSlots"
          type="number"
          min={0}
          max={3}
          defaultValue={3}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Plan notes (optional)
        <textarea
          name="note"
          maxLength={500}
          className="lodge-field min-h-20 px-3 py-2"
          placeholder="Voice chat, pace, or anything your group should know"
        />
      </label>
      <p className="text-text-muted text-sm sm:col-span-2">
        Your opted-in game nickname and this plan are visible to verified Guild members. Interest is
        a signal, not a party assignment.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="lodge-button px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Posting…' : 'Post group plan'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ExpeditionInterestForm({
  postId,
  characters,
  roles,
  current,
  open,
}: {
  postId: string;
  characters: { id: string; character_name: string; realm_slug: string }[];
  roles: ('tank' | 'healer' | 'damage')[];
  current: { character_id: string; role: string; score_shared: boolean } | null;
  open: boolean;
}) {
  const [state, action, pending] = useActionState(setExpeditionInterest, initialState);
  const [removeState, removeAction, removing] = useActionState(
    removeExpeditionInterest,
    initialState,
  );
  return (
    <div className="mt-4 space-y-2">
      {open && (
        <form
          key={`${postId}:${current?.character_id}:${current?.role}:${current?.score_shared}`}
          action={action}
          className="grid gap-2 sm:grid-cols-2"
        >
          <input type="hidden" name="postId" value={postId} />
          <label className="text-text-muted grid gap-1 text-sm">
            Traveler you added
            <select
              name="characterId"
              required
              defaultValue={current?.character_id ?? ''}
              className="lodge-field px-3 py-2"
            >
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
            Role you want to play
            <select
              name="role"
              required
              defaultValue={current?.role ?? ''}
              className="lodge-field px-3 py-2"
            >
              <option value="" disabled>
                Choose a requested role
              </option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role === 'damage' ? 'Damage' : role === 'healer' ? 'Healer' : 'Tank'}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="shareScore" value="false" />
          <label className="text-text-muted flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="shareScore"
              value="true"
              defaultChecked={current?.score_shared ?? false}
              className="mt-1"
            />
            Share this named character’s last saved Raider.IO Mythic+ score and source with this
            Guild for this post. It may be stale; if no snapshot is saved, no score is shared.
            Clearing this box removes the shared copy when I save again.
          </label>
          <p className="text-text-muted text-sm sm:col-span-2">
            Your Guild nickname, Traveler, and chosen role are shared with this Guild. Adding a
            Traveler does not verify that you control the character. You can remove your interest.
          </p>
          {current?.score_shared && (
            <p className="text-text-muted text-sm sm:col-span-2" role="status">
              Score currently shared for this post.
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !characters.length || !roles.length}
            className="lodge-button-secondary px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? 'Saving…' : current ? 'Update interest' : 'I’m interested'}
          </button>
          <Result state={state} />
        </form>
      )}
      {current && (
        <div className="flex flex-wrap items-center gap-3">
          {current.score_shared && <ExpeditionScoreClearButton postId={postId} />}
          <form action={removeAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="postId" value={postId} />
            <button
              type="submit"
              disabled={removing}
              className="text-accent text-sm underline disabled:opacity-60"
            >
              Remove my interest
            </button>
            <Result state={removeState} />
          </form>
        </div>
      )}
    </div>
  );
}

export function ExpeditionScoreClearButton({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(clearExpeditionInterestScore, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        disabled={pending}
        className="text-accent text-sm underline disabled:opacity-60"
      >
        Clear my shared score
      </button>
      <Result state={state} />
    </form>
  );
}

export function ExpeditionInterestRemoveButton({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(removeExpeditionInterest, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        disabled={pending}
        className="text-accent text-sm underline disabled:opacity-60"
      >
        Remove my interest
      </button>
      <Result state={state} />
    </form>
  );
}

export function ExpeditionPostStatus({ id, status }: { id: string; status: 'open' | 'closed' }) {
  const [state, action, pending] = useActionState(setExpeditionPostStatus, initialState);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status === 'open' ? 'closed' : 'open'} />
      <button
        type="submit"
        disabled={pending}
        className="text-accent text-sm underline disabled:opacity-60"
      >
        {status === 'open' ? 'Close interest' : 'Reopen interest'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ExpeditionPostDeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteExpeditionPost, initialState);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-accent text-sm underline disabled:opacity-60"
      >
        Remove group post and interests
      </button>
      <Result state={state} />
    </form>
  );
}

export function ExpeditionGoalForm({
  guildId,
  resetOn,
  goal,
}: {
  guildId: string;
  resetOn: string;
  goal: {
    target_runs: number;
    target_key_level: number;
    completed_runs: number;
    note: string;
    shared: boolean;
  } | null;
}) {
  const [state, action, pending] = useActionState(saveExpeditionGoal, initialState);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="resetOn" value={resetOn} />
      <label className="text-text-muted grid gap-1 text-sm">
        Target runs
        <input
          name="targetRuns"
          type="number"
          min={1}
          max={100}
          defaultValue={goal?.target_runs ?? 4}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Target key level
        <input
          name="targetKeyLevel"
          type="number"
          min={2}
          max={40}
          defaultValue={goal?.target_key_level ?? 10}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Runs completed (your entry)
        <input
          name="completedRuns"
          type="number"
          min={0}
          max={100}
          defaultValue={goal?.completed_runs ?? 0}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-3">
        Planning note (optional)
        <textarea
          name="note"
          maxLength={300}
          defaultValue={goal?.note ?? ''}
          className="lodge-field min-h-16 px-3 py-2"
        />
      </label>
      <input type="hidden" name="shared" value="false" />
      <label className="text-text-muted flex items-start gap-2 text-sm sm:col-span-3">
        <input
          type="checkbox"
          name="shared"
          value="true"
          defaultChecked={goal?.shared ?? false}
          className="mt-1"
        />
        Share this manually entered weekly goal with verified Guild members. Vault notes remain
        private in the War Table.
      </label>
      <button
        type="submit"
        disabled={pending}
        className="lodge-button px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save weekly goal'}
      </button>
      <Result state={state} />
    </form>
  );
}
