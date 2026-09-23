import { notFound } from 'next/navigation';
import { Crown, ShieldCheck } from 'lucide-react';
import { LodgeInvitationForm } from '@/components/lodge-invitation-form';
import { LodgeMemberRoleControl } from '@/components/lodge-member-role-control';
import { RevokeLodgeInvitationControl } from '@/components/revoke-lodge-invitation-control';
import { DeleteLodgeControl, LeaveLodgeControl, LodgeOwnershipControls, RemoveLodgeMemberControl } from '@/components/lodge-management-controls';
import Link from 'next/link';
import { loadLodgeInvitations } from '@/lib/lodge-invitations';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

type Member = {
  id: string;
  profile_id: string;
  role: 'owner' | 'caretaker' | 'member' | 'guest';
  profiles: { display_name: string | null }[] | null;
};

export default async function CaretakersOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [memberships, params, { supabase, user }] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();
  if (selected.role !== 'owner') {
    return (
      <div className="mx-auto max-w-3xl">
        <section className="lodge-panel p-7 sm:p-10">
          <ShieldCheck className="text-accent" size={28} aria-hidden="true" />
          <p className="lodge-kicker mt-6">Lodge settings</p>
          <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
            Caretaker&apos;s Office
          </h1>
          <p className="text-text-muted mt-4 leading-7">
            Only {selected.lodges.name}&apos;s owner can create invitations or change Lodge roles.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LeaveLodgeControl lodgeId={selected.lodge_id} disabled={false} />
            <Link href="/lodges/new" className="text-accent self-start underline underline-offset-4">Create another Lodge</Link>
          </div>
        </section>
      </div>
    );
  }

  const [{ data: members, error: membersError }, invitations] = await Promise.all([
    supabase
      .from('lodge_members')
      .select('id, profile_id, role, profiles(display_name)')
      .eq('lodge_id', selected.lodge_id)
      .order('joined_at', { ascending: true }),
    loadLodgeInvitations(supabase, selected.lodge_id),
  ]);
  const memberRows = membersError ? null : (members as Member[] | null);
  const { data: transferData } = await supabase
    .from('lodge_ownership_transfers')
    .select('id, to_membership_id')
    .eq('lodge_id', selected.lodge_id)
    .is('accepted_at', null)
    .is('canceled_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  const pendingTransfer = transferData ? { id: transferData.id, recipientId: transferData.to_membership_id } : null;
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm">
          <Crown size={18} aria-hidden="true" /> Lodge stewardship
        </p>
        <h1 className="font-display text-text-primary mt-3 text-3xl font-bold sm:text-4xl">
          Caretaker&apos;s Office
        </h1>
        <p className="text-text-muted mt-3">
          Welcome new Travelers and care for {selected.lodges.name}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link href="/lodges/new" className="text-accent underline underline-offset-4">Create another Lodge</Link>
          {memberships.length > 1 && memberships.filter((membership) => membership.lodge_id !== selected.lodge_id).map((membership) => (
            <Link key={membership.lodge_id} href={`/caretakers-office?lodge=${membership.lodge_id}`} className="text-text-muted underline underline-offset-4">Switch to {membership.lodges.name}</Link>
          ))}
        </div>
      </header>

      <LodgeInvitationForm lodgeId={selected.lodge_id} lodgeName={selected.lodges.name} />

      <section className="lodge-panel p-6 sm:p-8" aria-labelledby="members-heading">
        <p className="lodge-kicker">Lodge fellowship</p>
        <h2 id="members-heading" className="font-display text-text-primary mt-2 text-2xl font-bold">
          Member roles
        </h2>
        {memberRows === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Lodge members could not be loaded. Please try again later.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {memberRows.map((member) => (
              <li
                key={member.id}
                className="lodge-list-row flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-text-primary font-medium">
                    {member.profiles?.[0]?.display_name?.trim() || 'Lodge member'}
                    {member.profile_id === user.id ? ' (you)' : ''}
                  </p>
                  <p className="text-text-muted mt-1 text-sm capitalize">{member.role}</p>
                </div>
                {member.role === 'owner' ? (
                  <p className="text-text-muted text-sm">Owner role is protected.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3"><LodgeMemberRoleControl membershipId={member.id} role={member.role} /><RemoveLodgeMemberControl membershipId={member.id} /></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lodge-panel p-6 sm:p-8" aria-labelledby="ownership-heading">
        <p className="lodge-kicker">Stewardship</p>
        <h2 id="ownership-heading" className="font-display text-text-primary mt-2 text-2xl font-bold">Transfer ownership</h2>
        <p className="text-text-muted mt-2 text-sm">The recipient must accept before ownership changes.</p>
        <LodgeOwnershipControls members={(memberRows ?? []).filter((member) => member.id !== selected.id).map((member) => ({ id: member.id, name: member.profiles?.[0]?.display_name?.trim() || 'Lodge member' }))} pendingTransfer={pendingTransfer} recipient={pendingTransfer?.recipientId === selected.id} />
      </section>

      <section className="lodge-panel p-6 sm:p-8" aria-labelledby="membership-heading">
        <p className="lodge-kicker">Your membership</p>
        <h2 id="membership-heading" className="font-display text-text-primary mt-2 text-2xl font-bold">Leave or delete</h2>
        <p className="text-text-muted mt-2 text-sm">Leaving revokes this Lodge&apos;s access to your shared Travelers.</p>
        <div className="mt-4"><LeaveLodgeControl lodgeId={selected.lodge_id} disabled={selected.role === 'owner'} /></div>
        <div className="border-border mt-6 border-t pt-6"><p className="text-red-300 font-medium">Permanent action</p><p className="text-text-muted mt-2 text-sm">Deleting removes this Lodge and its Lodge-scoped content for every member.</p><DeleteLodgeControl lodgeId={selected.lodge_id} lodgeName={selected.lodges.name} /></div>
      </section>

      <section className="lodge-panel p-6 sm:p-8" aria-labelledby="invitations-heading">
        <p className="lodge-kicker">Pending welcome</p>
        <h2
          id="invitations-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          Invitations
        </h2>
        {invitations === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Invitations could not be loaded. Please try again later.
          </p>
        ) : invitations.length === 0 ? (
          <p className="text-text-muted mt-5">No invitations have been created yet.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {invitations.map((invitation) => {
              const state = invitation.accepted_at
                ? 'Accepted'
                : invitation.revoked_at
                  ? 'Revoked'
                  : new Date(invitation.expires_at) <= new Date()
                    ? 'Expired'
                    : 'Active';
              return (
                <li
                  key={invitation.id}
                  className="lodge-list-row flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-text-primary font-medium">
                      {invitation.email ?? 'Shareable invitation'}
                    </p>
                    <p className="text-text-muted mt-1 text-sm">
                      {invitation.role} · {state} · expires{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(invitation.expires_at))}{' '}
                      UTC
                    </p>
                  </div>
                  {state === 'Active' && (
                    <RevokeLodgeInvitationControl invitationId={invitation.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
