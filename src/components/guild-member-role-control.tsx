'use client';

import { useActionState } from 'react';
import { updateGuildMemberRole, type GuildMemberRoleState } from '@/app/(app)/guild-hall/actions';

const initialState: GuildMemberRoleState = { error: null, success: null };

const labels = {
  officer: 'Officer',
  raid_leader: 'Raid Leader',
  loot_council: 'Loot Council',
} as const;

export function GuildMemberRoleControl({
  membershipId,
  role,
  enabled,
  editable,
}: {
  membershipId: string;
  role: keyof typeof labels;
  enabled: boolean;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateGuildMemberRole, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={!editable || pending}
        className="lodge-button-secondary px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        aria-pressed={enabled}
      >
        {pending ? 'Saving…' : `${enabled ? 'Remove' : 'Grant'} ${labels[role]}`}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted text-xs">
          {state.success}
        </p>
      )}
    </form>
  );
}
