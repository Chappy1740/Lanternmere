'use client';

import { useActionState } from 'react';
import {
  addRecruitmentNote,
  deleteRecruitmentApplication,
  saveRecruitmentNeed,
  setRecruitmentStage,
  submitRecruitmentApplication,
  type MusterState,
} from '@/app/(app)/muster/actions';

const initialState: MusterState = { message: '', error: false };

function Result({ state }: { state: MusterState }) {
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

export function RecruitmentNeedForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(saveRecruitmentNeed, initialState);
  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="active" value="true" />
      <label className="text-text-muted grid gap-1 text-sm">
        Role
        <select name="raidRole" className="lodge-field px-3 py-2">
          <option value="tank">Tank</option>
          <option value="healer">Healer</option>
          <option value="damage">Damage</option>
          <option value="flex">Flexible</option>
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Open spots
        <input
          name="slots"
          type="number"
          min={1}
          max={20}
          defaultValue={1}
          required
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Class (optional)
        <input name="className" maxLength={40} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Spec (optional)
        <input name="specName" maxLength={40} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        What your Guild needs
        <textarea name="description" maxLength={500} className="lodge-field min-h-20 px-3 py-2" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="lodge-button px-4 py-2">
          {pending ? 'Saving…' : 'Post need'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RecruitmentNeedToggle({
  need,
}: {
  need: {
    id: string;
    guild_id: string;
    raid_role: string;
    class_name: string | null;
    spec_name: string | null;
    slots: number;
    description: string;
    active: boolean;
  };
}) {
  const [state, action, pending] = useActionState(saveRecruitmentNeed, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="guildId" value={need.guild_id} />
      <input type="hidden" name="id" value={need.id} />
      <input type="hidden" name="raidRole" value={need.raid_role} />
      <input type="hidden" name="className" value={need.class_name ?? ''} />
      <input type="hidden" name="specName" value={need.spec_name ?? ''} />
      <input type="hidden" name="slots" value={need.slots} />
      <input type="hidden" name="description" value={need.description} />
      <input type="hidden" name="active" value={need.active ? 'false' : 'true'} />
      <button disabled={pending} className="text-accent text-sm hover:underline">
        {pending ? 'Saving…' : need.active ? 'Close need' : 'Reopen need'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function RecruitmentApplicationForm({
  guildId,
  characters,
}: {
  guildId: string;
  characters: { id: string; character_name: string; realm_slug: string }[];
}) {
  const [state, action, pending] = useActionState(submitRecruitmentApplication, initialState);
  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="text-text-muted grid gap-1 text-sm">
        Role
        <select name="raidRole" className="lodge-field px-3 py-2">
          <option value="tank">Tank</option>
          <option value="healer">Healer</option>
          <option value="damage">Damage</option>
          <option value="flex">Flexible</option>
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Your Traveler (optional)
        <select name="characterId" className="lodge-field px-3 py-2" defaultValue="">
          <option value="">No linked Traveler</option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.character_name} · {character.realm_slug}
            </option>
          ))}
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Class (optional)
        <input name="className" maxLength={40} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Spec (optional)
        <input name="specName" maxLength={40} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Availability
        <textarea
          name="availability"
          maxLength={500}
          className="lodge-field min-h-20 px-3 py-2"
          placeholder="Days and times that usually work for you"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Experience
        <textarea
          name="experience"
          required
          minLength={10}
          maxLength={1000}
          className="lodge-field min-h-24 px-3 py-2"
          placeholder="Tell the Guild about your play experience and goals"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Character profile link (optional)
        <input
          name="profileUrl"
          type="url"
          maxLength={500}
          className="lodge-field px-3 py-2"
          placeholder="https://…"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Log link (optional)
        <input
          name="logUrl"
          type="url"
          maxLength={500}
          className="lodge-field px-3 py-2"
          placeholder="https://…"
        />
      </label>
      <p className="text-text-muted text-sm sm:col-span-2">
        Applying shares your display name and the details above with this Guild’s verified
        recruiters. Links are applicant-provided and are not a score. You can delete your
        application and private review notes later.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="lodge-button px-4 py-2">
          {pending ? 'Submitting…' : 'Submit application'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RecruitmentReviewForm({
  id,
  currentStatus,
  canDecide,
  trialStartsOn,
  trialEndsOn,
}: {
  id: string;
  currentStatus: 'submitted' | 'reviewing' | 'trial';
  canDecide: boolean;
  trialStartsOn: string | null;
  trialEndsOn: string | null;
}) {
  const [state, action, pending] = useActionState(setRecruitmentStage, initialState);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-text-muted grid gap-1 text-sm">
        Next stage
        <select name="status" className="lodge-field px-3 py-2">
          {currentStatus === 'submitted' && <option value="reviewing">Reviewing</option>}
          <option value="trial">
            {currentStatus === 'trial' ? 'Update trial' : 'Start trial'}
          </option>
          {canDecide && (
            <>
              {currentStatus === 'trial' && <option value="accepted">Accept</option>}
              <option value="declined">Decline</option>
            </>
          )}
        </select>
      </label>
      <div />
      <label className="text-text-muted grid gap-1 text-sm">
        Trial start (when starting a trial)
        <input
          name="trialStartsOn"
          type="date"
          defaultValue={trialStartsOn ?? ''}
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Trial end
        <input
          name="trialEndsOn"
          type="date"
          defaultValue={trialEndsOn ?? ''}
          className="lodge-field px-3 py-2"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Trial attendance context (officer-entered)
        <textarea
          name="attendanceContext"
          maxLength={1000}
          className="lodge-field min-h-20 px-3 py-2"
          placeholder="Record observed attendance without implying a Quest Board RSVP"
        />
      </label>
      {canDecide && (
        <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
          Private decision reason (required for accept or decline)
          <textarea
            name="decisionNote"
            maxLength={1000}
            className="lodge-field min-h-20 px-3 py-2"
          />
        </label>
      )}
      {!canDecide && <input type="hidden" name="decisionNote" value="" />}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="lodge-button-secondary px-4 py-2">
          {pending ? 'Saving…' : 'Record stage'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RecruitmentNoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addRecruitmentNote, initialState);
  return (
    <form action={action} className="mt-4 grid gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-text-muted grid gap-1 text-sm">
        Private recruiter note
        <textarea
          name="note"
          required
          maxLength={1000}
          className="lodge-field min-h-20 px-3 py-2"
        />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="lodge-button-secondary px-4 py-2">
          {pending ? 'Saving…' : 'Add note'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RecruitmentDeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteRecruitmentApplication, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-sm text-amber-200 hover:underline">
        {pending ? 'Deleting…' : 'Delete application and notes'}
      </button>
      <Result state={state} />
    </form>
  );
}
