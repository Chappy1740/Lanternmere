'use client';

import { useActionState } from 'react';
import {
  acceptLodgeOwnershipTransfer,
  cancelLodgeOwnershipTransfer,
  deleteLodge,
  leaveLodge,
  removeLodgeMember,
  requestLodgeOwnershipTransfer,
  type LodgeManagementState,
} from '@/app/(app)/(lodge)/caretakers-office/actions';

const initial: LodgeManagementState = { error: null, success: null };
function Feedback({ state }: { state: LodgeManagementState }) { return <>{state.error && <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>}{state.success && <p role="status" className="text-text-muted mt-3 text-sm">{state.success}</p>}</>; }

export function LeaveLodgeControl({ lodgeId, disabled }: { lodgeId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(leaveLodge, initial);
  return <form action={action}><input type="hidden" name="lodgeId" value={lodgeId} /><button type="submit" disabled={disabled || pending} className="lodge-button-secondary px-4 py-2 text-sm disabled:opacity-60">{pending ? 'Leaving…' : 'Leave Lodge'}</button>{disabled && <p className="text-text-muted mt-2 text-sm">Transfer ownership or delete the Lodge before leaving.</p>}<Feedback state={state} /></form>;
}

export function RemoveLodgeMemberControl({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(removeLodgeMember, initial);
  return <form action={action}><input type="hidden" name="membershipId" value={membershipId} /><button type="submit" disabled={pending} className="lodge-button-secondary px-4 py-2 text-sm disabled:opacity-60">{pending ? 'Removing…' : 'Remove member'}</button><Feedback state={state} /></form>;
}

export function LodgeOwnershipControls({ members, pendingTransfer, recipient }: { members: { id: string; name: string }[]; pendingTransfer: { id: string; recipientId: string } | null; recipient: boolean }) {
  const [requestState, requestAction, requesting] = useActionState(requestLodgeOwnershipTransfer, initial);
  const [acceptState, acceptAction, accepting] = useActionState(acceptLodgeOwnershipTransfer, initial);
  const [cancelState, cancelAction, canceling] = useActionState(cancelLodgeOwnershipTransfer, initial);
  if (recipient && pendingTransfer) return <form action={acceptAction} className="mt-4"><input type="hidden" name="transferId" value={pendingTransfer.id} /><button type="submit" disabled={accepting} className="lodge-button px-4 py-2 text-sm disabled:opacity-60">{accepting ? 'Accepting…' : 'Accept Lodge ownership'}</button><Feedback state={acceptState} /></form>;
  if (pendingTransfer) return <form action={cancelAction} className="mt-4"><input type="hidden" name="transferId" value={pendingTransfer.id} /><button type="submit" disabled={canceling} className="lodge-button-secondary px-4 py-2 text-sm disabled:opacity-60">{canceling ? 'Canceling…' : 'Cancel ownership transfer'}</button><Feedback state={cancelState} /></form>;
  if (!members.length) return <p className="text-text-muted mt-3 text-sm">Invite another member before transferring ownership.</p>;
  return <form action={requestAction} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">New owner<select name="toMembershipId" className="lodge-field mt-1 block min-w-48 px-3 py-2" disabled={requesting}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button type="submit" disabled={requesting} className="lodge-button px-4 py-2 text-sm disabled:opacity-60">{requesting ? 'Requesting…' : 'Request transfer'}</button><Feedback state={requestState} /></form>;
}

export function DeleteLodgeControl({ lodgeId, lodgeName }: { lodgeId: string; lodgeName: string }) {
  const [state, action, pending] = useActionState(deleteLodge, initial);
  return <form action={action} className="mt-4"><input type="hidden" name="lodgeId" value={lodgeId} /><label className="text-sm font-medium">Type <span className="font-mono">DELETE {lodgeName}</span> to permanently delete this Lodge.<input name="confirmation" required className="lodge-field mt-2 block w-full px-3 py-2" autoComplete="off" /></label><button type="submit" disabled={pending} className="mt-3 rounded-md border border-red-400/60 px-4 py-2 text-sm text-red-300 disabled:opacity-60">{pending ? 'Deleting…' : 'Delete Lodge permanently'}</button><Feedback state={state} /></form>;
}
