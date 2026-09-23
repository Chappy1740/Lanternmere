'use client';

import { useActionState } from 'react';
import {
  createGuildRaidAssignment,
  createGuildRaidOperation,
  saveGuildRaidOperationMember,
  saveGuildRaidOperationNotes,
  type GuildRaidOperationState,
} from '@/app/(app)/guild-hall/actions';
import type {
  GuildMember,
  GuildRaidAssignment,
  GuildRaidOperation,
  GuildRaidOperationMember,
} from '@/lib/guilds';

const initial: GuildRaidOperationState = { error: null, success: null };
function Message({ state }: { state: GuildRaidOperationState }) {
  return state.error ? (
    <p role="alert" className="mt-2 text-sm text-red-400">
      {state.error}
    </p>
  ) : state.success ? (
    <p role="status" className="text-text-muted mt-2 text-sm">
      {state.success}
    </p>
  ) : null;
}

export function GuildRaidOperationCreate({
  guildId,
  events,
}: {
  guildId: string;
  events: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createGuildRaidOperation, initial);
  return (
    <form action={action} className="mt-4 flex flex-wrap gap-3">
      <input type="hidden" name="guildId" value={guildId} />
      <select
        name="eventId"
        required
        className="border-border bg-background rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Choose an authorized Quest Board event</option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.label}
          </option>
        ))}
      </select>
      <button
        disabled={pending || !events.length}
        className="lodge-button px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Authorizing…' : 'Authorize operation'}
      </button>
      <Message state={state} />
    </form>
  );
}

export function GuildRaidOperations({
  operations,
  members,
  assignments,
  guildMembers,
}: {
  operations: GuildRaidOperation[];
  members: GuildRaidOperationMember[];
  assignments: GuildRaidAssignment[];
  guildMembers: GuildMember[];
}) {
  if (!operations.length)
    return (
      <p className="text-text-muted mt-4 text-sm">
        No Guild raid operation has been authorized yet.
      </p>
    );
  const names = new Map(
    guildMembers.map((member) => [member.id, member.profiles?.display_name ?? 'Guild member']),
  );
  return (
    <div className="mt-5 space-y-6">
      {operations.map((operation) => (
        <Operation
          key={operation.id}
          operation={operation}
          members={members.filter((row) => row.operation_id === operation.id)}
          assignments={assignments.filter((row) => row.operation_id === operation.id)}
          guildMembers={guildMembers}
          names={names}
        />
      ))}
    </div>
  );
}

function Operation({
  operation,
  members,
  assignments,
  guildMembers,
  names,
}: {
  operation: GuildRaidOperation;
  members: GuildRaidOperationMember[];
  assignments: GuildRaidAssignment[];
  guildMembers: GuildMember[];
  names: Map<string, string>;
}) {
  const [notesState, notesAction, notesPending] = useActionState(
    saveGuildRaidOperationNotes,
    initial,
  );
  const [memberState, memberAction, memberPending] = useActionState(
    saveGuildRaidOperationMember,
    initial,
  );
  const [assignmentState, assignmentAction, assignmentPending] = useActionState(
    createGuildRaidAssignment,
    initial,
  );
  return (
    <article className="lodge-list-row p-5">
      <h3 className="text-text-primary font-display text-lg font-bold">{operation.title}</h3>
      <p className="text-text-muted mt-1 text-sm">
        {operation.event_date}
        {operation.event_time ? ` · ${operation.event_time.slice(0, 5)} UTC` : ''}
        {operation.activity_type ? ` · ${operation.activity_type}` : ''}
        {operation.difficulty ? ` · ${operation.difficulty}` : ''}
      </p>
      <p className="text-text-muted mt-2 text-xs">
        Authorized canonical-event projection. Quest Board details and RSVPs remain private to the
        Lodge.
      </p>
      <form action={notesAction} className="mt-4">
        <input type="hidden" name="operationId" value={operation.id} />
        <label className="text-sm font-medium" htmlFor={`notes-${operation.id}`}>
          Guild operational notes
        </label>
        <textarea
          id={`notes-${operation.id}`}
          name="notes"
          defaultValue={operation.operational_notes}
          maxLength={4000}
          className="border-border bg-background mt-2 block min-h-24 w-full rounded-md border p-3 text-sm"
        />
        <button
          disabled={notesPending}
          className="lodge-button-secondary mt-2 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {notesPending ? 'Saving…' : 'Save notes'}
        </button>
        <Message state={notesState} />
      </form>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={memberAction}>
          <input type="hidden" name="operationId" value={operation.id} />
          <p className="text-sm font-medium">Plan Guild roster</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              name="memberId"
              required
              className="border-border bg-background rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Guild member</option>
              {guildMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {names.get(member.id)}
                </option>
              ))}
            </select>
            <select
              name="status"
              className="border-border bg-background rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="selected">Selected</option>
              <option value="bench">Bench</option>
            </select>
            <select
              name="role"
              className="border-border bg-background rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="tank">Tank</option>
              <option value="healer">Healer</option>
              <option value="dps">DPS</option>
            </select>
            <button
              disabled={memberPending}
              className="lodge-button-secondary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <Message state={memberState} />
          <ul className="mt-3 space-y-1 text-sm">
            {members.map((member) => (
              <li key={member.id}>
                {names.get(member.guild_member_id)} · {member.planning_status} ·{' '}
                {member.raid_role.toUpperCase()}
              </li>
            ))}
          </ul>
        </form>
        <form action={assignmentAction}>
          <input type="hidden" name="operationId" value={operation.id} />
          <p className="text-sm font-medium">Guild assignments</p>
          <input
            name="title"
            required
            maxLength={160}
            placeholder="Responsibility"
            className="border-border bg-background mt-2 block w-full rounded-md border px-2 py-1.5 text-sm"
          />
          <textarea
            name="details"
            maxLength={2000}
            placeholder="Optional planning detail"
            className="border-border bg-background mt-2 block min-h-16 w-full rounded-md border p-2 text-sm"
          />
          <select
            name="memberId"
            className="border-border bg-background mt-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {guildMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {names.get(member.id)}
              </option>
            ))}
          </select>
          <button
            disabled={assignmentPending}
            className="lodge-button-secondary ml-2 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Add
          </button>
          <Message state={assignmentState} />
          <ul className="mt-3 space-y-1 text-sm">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <span className="font-medium">{assignment.title}</span>
                {assignment.assigned_guild_member_id
                  ? ` · ${names.get(assignment.assigned_guild_member_id)}`
                  : ''}
                {assignment.details ? ` — ${assignment.details}` : ''}
              </li>
            ))}
          </ul>
        </form>
      </div>
    </article>
  );
}
