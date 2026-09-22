'use client';

import { useActionState } from 'react';
import {
  acceptGuildOwnershipTransfer,
  cancelGuildOwnershipTransfer,
  requestGuildOwnershipTransfer,
  type GuildOwnershipTransferState,
} from '@/app/(app)/guild-hall/actions';

const initialState: GuildOwnershipTransferState = { error: null, success: null };

function Feedback({ state }: { state: GuildOwnershipTransferState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-2 text-sm">
          {state.success}
        </p>
      )}
    </>
  );
}

export function GuildOwnershipTransferRequest({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(requestGuildOwnershipTransfer, initialState);
  if (!members.length)
    return (
      <p className="text-text-muted mt-3 text-sm">
        Invite another Guild member before transferring ownership.
      </p>
    );
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">
        New Guild Master
        <select
          name="toMemberId"
          className="lodge-field mt-1 block min-w-48 px-3 py-2"
          disabled={pending}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="lodge-button px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Requesting…' : 'Request transfer'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function GuildOwnershipTransferAccept({ transferId }: { transferId: string }) {
  const [state, action, pending] = useActionState(acceptGuildOwnershipTransfer, initialState);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="transferId" value={transferId} />
      <button
        type="submit"
        disabled={pending}
        className="lodge-button px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Accepting…' : 'Accept Guild Master ownership'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function GuildOwnershipTransferCancel({ transferId }: { transferId: string }) {
  const [state, action, pending] = useActionState(cancelGuildOwnershipTransfer, initialState);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="transferId" value={transferId} />
      <button
        type="submit"
        disabled={pending}
        className="lodge-button-secondary px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Canceling…' : 'Cancel transfer'}
      </button>
      <Feedback state={state} />
    </form>
  );
}
