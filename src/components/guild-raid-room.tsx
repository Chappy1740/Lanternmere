'use client';

import { useActionState } from 'react';
import {
  createGuildRaidEncounter,
  createGuildRaidEncounterDirective,
  saveGuildRaidEncounterStrategy,
  createGuildRaidLootDrop,
  saveGuildRaidLootCandidate,
  castGuildRaidLootVote,
  awardGuildRaidLoot,
  type GuildRaidEncounterState,
} from '@/app/(app)/guild-hall/actions';
import type {
  GuildMember,
  GuildRaidEncounter,
  GuildRaidEncounterDirective,
  GuildRaidOperation,
  GuildRaidLootDrop,
  GuildRaidLootCandidate,
  GuildRaidLootVote,
  GuildRaidLootAward,
  GuildRaidOperationMember,
  GuildRaidAttendance,
} from '@/lib/guilds';

const initial: GuildRaidEncounterState = { error: null, success: null };

function Message({ state }: { state: GuildRaidEncounterState }) {
  if (!state.error && !state.success) return null;
  return (
    <p role={state.error ? 'alert' : 'status'} className="text-text-muted mt-2 text-xs">
      {state.error ?? state.success}
    </p>
  );
}

export function GuildRaidRoom({
  guildId,
  operation,
  guildMembers,
  encounters,
  directives,
  loot,
  plannedMembers,
  attendance,
  readiness,
}: {
  guildId: string;
  operation: GuildRaidOperation;
  guildMembers: GuildMember[];
  encounters: GuildRaidEncounter[];
  directives: GuildRaidEncounterDirective[];
  loot: {
    drops: GuildRaidLootDrop[];
    candidates: GuildRaidLootCandidate[];
    votes: GuildRaidLootVote[];
    awards: GuildRaidLootAward[];
  };
  plannedMembers: GuildRaidOperationMember[];
  attendance: GuildRaidAttendance[];
  readiness: { id: string; name: string; className: string | null; spec: string | null }[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createGuildRaidEncounter,
    initial,
  );
  const names = new Map(
    guildMembers.map((member) => [member.id, member.profiles?.display_name ?? 'Guild member']),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="lodge-panel p-5 sm:p-7">
        <a
          href={`/guild-hall?guild=${guildId}`}
          className="text-accent text-sm underline underline-offset-4"
        >
          Back to Guild Hall
        </a>
        <p className="lodge-kicker mt-5">Raid Mode</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          {operation.title}
        </h1>
        <p className="text-text-muted mt-2 text-sm">
          {operation.event_date}
          {operation.event_time ? ` · ${operation.event_time.slice(0, 5)} UTC` : ''} · Focused
          leadership workspace
        </p>
        <p className="text-text-muted mt-3 text-xs">
          Encounter plans are Guild-owned, leadership-visible, and audited. Quest Board event
          details and RSVPs are not shown here.
        </p>
      </header>
      <RosterSupport
        plannedMembers={plannedMembers}
        attendance={attendance}
        readiness={readiness}
      />

      <section className="lodge-panel p-5 sm:p-6">
        <h2 className="font-display text-text-primary text-xl font-bold">
          Add encounter workspace
        </h2>
        <form action={createAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="operationId" value={operation.id} />
          <label className="text-sm">
            Encounter
            <input
              name="title"
              required
              maxLength={160}
              placeholder="Boss or phase"
              className="border-border bg-background mt-1 block w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Order
            <input
              name="encounterOrder"
              type="number"
              min="0"
              max="1000"
              defaultValue="0"
              className="border-border bg-background mt-1 block w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Strategy
            <textarea
              name="strategy"
              maxLength={6000}
              placeholder="Plan, phases, positioning, and recovery notes"
              className="border-border bg-background mt-1 block min-h-28 w-full rounded-md border p-3"
            />
          </label>
          <button
            disabled={createPending}
            className="lodge-button-secondary w-fit px-4 py-2 text-sm disabled:opacity-50"
          >
            {createPending ? 'Adding…' : 'Add encounter'}
          </button>
        </form>
        <Message state={createState} />
      </section>
      <LootCouncil operationId={operation.id} guildMembers={guildMembers} names={names} {...loot} />

      {encounters.length ? (
        encounters.map((encounter) => (
          <EncounterCard
            key={encounter.id}
            encounter={encounter}
            directives={directives.filter((directive) => directive.encounter_id === encounter.id)}
            guildMembers={guildMembers}
            names={names}
          />
        ))
      ) : (
        <section className="lodge-panel text-text-muted p-6 text-sm">
          No encounter workspace has been created for this raid yet.
        </section>
      )}
    </div>
  );
}

function RosterSupport({
  plannedMembers,
  attendance,
  readiness,
}: {
  plannedMembers: GuildRaidOperationMember[];
  attendance: GuildRaidAttendance[];
  readiness: { id: string; name: string; className: string | null; spec: string | null }[];
}) {
  const selected = plannedMembers.filter((entry) => entry.planning_status === 'selected');
  const bench = plannedMembers.length - selected.length;
  const count = (role: GuildRaidOperationMember['raid_role']) =>
    selected.filter((entry) => entry.raid_role === role).length;
  const confirmed = attendance.filter((entry) => entry.attendance_status === 'confirmed').length;
  const invited = attendance.filter((entry) => entry.attendance_status === 'invited').length;
  const absent = attendance.filter((entry) => entry.attendance_status === 'absent').length;
  const selectedContext = selected.flatMap((member) => {
    const character = readiness.find((entry) => entry.id === member.character_id);
    return character ? [character] : [];
  });
  const meleeClasses = new Set([
    'Death Knight',
    'Demon Hunter',
    'Druid',
    'Monk',
    'Paladin',
    'Rogue',
    'Warrior',
  ]);
  const melee = selectedContext.filter(
    (character) => character.className && meleeClasses.has(character.className),
  ).length;
  const ranged = selectedContext.filter(
    (character) => character.className && !meleeClasses.has(character.className),
  ).length;
  const utility = [
    ['Bloodlust', ['Evoker', 'Hunter', 'Mage', 'Shaman']],
    ['Battle resurrection', ['Death Knight', 'Druid', 'Warlock']],
    ['Group speed', ['Druid', 'Hunter', 'Monk', 'Priest', 'Shaman']],
  ].filter(([, classes]) =>
    selectedContext.some((character) => classes.includes(character.className ?? '')),
  );
  return (
    <section className="lodge-panel p-5 sm:p-6">
      <p className="lodge-kicker">Smart roster support</p>
      <h2 className="font-display text-text-primary mt-2 text-xl font-bold">
        Decision support, not selection
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Selected" value={selected.length} />
        <Stat label="Bench" value={bench} />
        <Stat label="Confirmed" value={confirmed} />
        <Stat label="Invited" value={invited} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Tanks" value={count('tank')} />
        <Stat label="Healers" value={count('healer')} />
        <Stat label="DPS" value={count('dps')} />
      </div>
      {selectedContext.length > 0 && (
        <p className="text-text-muted mt-3 text-xs">
          Selected Traveler context:{' '}
          {selectedContext
            .map(
              (character) =>
                `${character.name} · ${character.className ?? 'Class unavailable'}${character.spec ? ` (${character.spec})` : ''}`,
            )
            .join(' · ')}
        </p>
      )}
      {selectedContext.length > 0 && (
        <p className="text-text-muted mt-2 text-xs">
          Potential mix: {melee} melee-class · {ranged} ranged-class. Potential utility:{' '}
          {utility.length ? utility.map(([label]) => label).join(' · ') : 'none identified'}.
        </p>
      )}
      <p className="text-text-muted mt-4 text-xs">
        Availability uses the Guild operational attendance record only; Quest Board RSVPs remain
        untouched.{' '}
        {absent
          ? `${absent} absent record${absent === 1 ? '' : 's'} logged.`
          : 'No absences logged.'}{' '}
        Class/spec, melee/ranged, and utility coverage require a consented character selection per
        planned member and remain unavailable when that context has not been shared.
      </p>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="lodge-list-row p-3">
      <p className="text-text-primary text-xl font-bold">{value}</p>
      <p className="text-text-muted text-xs">{label}</p>
    </div>
  );
}

function LootCouncil({
  operationId,
  guildMembers,
  names,
  drops,
  candidates,
  votes,
  awards,
}: {
  operationId: string;
  guildMembers: GuildMember[];
  names: Map<string, string>;
  drops: GuildRaidLootDrop[];
  candidates: GuildRaidLootCandidate[];
  votes: GuildRaidLootVote[];
  awards: GuildRaidLootAward[];
}) {
  const [dropState, dropAction, dropPending] = useActionState(createGuildRaidLootDrop, initial);
  const [candidateState, candidateAction, candidatePending] = useActionState(
    saveGuildRaidLootCandidate,
    initial,
  );
  const [voteState, voteAction, votePending] = useActionState(castGuildRaidLootVote, initial);
  const [awardState, awardAction, awardPending] = useActionState(awardGuildRaidLoot, initial);
  return (
    <section className="lodge-panel p-5 sm:p-6">
      <p className="lodge-kicker">Loot Council</p>
      <h2 className="font-display text-text-primary mt-2 text-xl font-bold">
        Human decision record
      </h2>
      <p className="text-text-muted mt-2 text-sm">
        Interest and factual context inform the council; votes do not choose an award automatically.
      </p>
      <form action={dropAction} className="mt-4 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="operationId" value={operationId} />
        <input
          name="itemName"
          required
          maxLength={160}
          placeholder="Dropped item"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="itemLevel"
          type="number"
          min="1"
          max="1000"
          placeholder="Item level (optional)"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="slot"
          maxLength={80}
          placeholder="Slot (optional)"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="sourceNote"
          maxLength={1000}
          placeholder="Source/context (optional)"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
        <button disabled={dropPending} className="lodge-button-secondary w-fit px-3 py-2 text-sm">
          {dropPending ? 'Recording…' : 'Record drop'}
        </button>
      </form>
      <Message state={dropState} />
      <div className="mt-5 space-y-5">
        {drops.map((drop) => {
          const dropCandidates = candidates.filter((c) => c.loot_drop_id === drop.id);
          const award = awards.find((a) => a.loot_drop_id === drop.id);
          return (
            <article key={drop.id} className="lodge-list-row p-4">
              <h3 className="text-text-primary font-medium">
                {drop.item_name}
                {drop.item_level ? ` · ${drop.item_level}` : ''}
              </h3>
              {award ? (
                <p className="text-accent mt-2 text-sm">
                  Awarded to{' '}
                  {names.get(
                    dropCandidates.find((c) => c.id === award.candidate_id)?.guild_member_id ?? '',
                  )}{' '}
                  — {award.reason}
                </p>
              ) : (
                <>
                  <form action={candidateAction} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="dropId" value={drop.id} />
                    <select
                      name="memberId"
                      required
                      className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="">Candidate</option>
                      {guildMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {names.get(m.id)}
                        </option>
                      ))}
                    </select>
                    <select
                      name="interest"
                      className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="need">Need</option>
                      <option value="offspec">Offspec</option>
                      <option value="pass">Pass</option>
                    </select>
                    <input
                      name="context"
                      maxLength={1000}
                      placeholder="Factual context"
                      className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                    />
                    <button
                      disabled={candidatePending}
                      className="lodge-button-secondary px-2 py-1 text-sm"
                    >
                      Save
                    </button>
                  </form>
                  <Message state={candidateState} />
                  <ul className="mt-3 space-y-1 text-sm">
                    {dropCandidates.map((c) => (
                      <li key={c.id}>
                        {names.get(c.guild_member_id)} · {c.interest}
                        {c.factual_context ? ` — ${c.factual_context}` : ''} ·{' '}
                        {votes.filter((v) => v.candidate_id === c.id).length} vote(s)
                      </li>
                    ))}
                  </ul>
                  {dropCandidates.length > 0 && (
                    <>
                      <form action={voteAction} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="dropId" value={drop.id} />
                        <select
                          name="candidateId"
                          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                        >
                          {dropCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {names.get(c.guild_member_id)}
                            </option>
                          ))}
                        </select>
                        <input
                          name="rationale"
                          maxLength={1000}
                          placeholder="Vote rationale"
                          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                        />
                        <button
                          disabled={votePending}
                          className="lodge-button-secondary px-2 py-1 text-sm"
                        >
                          Vote
                        </button>
                      </form>
                      <Message state={voteState} />
                      <form action={awardAction} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="dropId" value={drop.id} />
                        <select
                          name="candidateId"
                          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                        >
                          {dropCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {names.get(c.guild_member_id)}
                            </option>
                          ))}
                        </select>
                        <input
                          name="reason"
                          required
                          maxLength={1000}
                          placeholder="Required award reason"
                          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                        />
                        <button disabled={awardPending} className="lodge-button px-2 py-1 text-sm">
                          Record award
                        </button>
                      </form>
                      <Message state={awardState} />
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EncounterCard({
  encounter,
  directives,
  guildMembers,
  names,
}: {
  encounter: GuildRaidEncounter;
  directives: GuildRaidEncounterDirective[];
  guildMembers: GuildMember[];
  names: Map<string, string>;
}) {
  const [strategyState, strategyAction, strategyPending] = useActionState(
    saveGuildRaidEncounterStrategy,
    initial,
  );
  const [directiveState, directiveAction, directivePending] = useActionState(
    createGuildRaidEncounterDirective,
    initial,
  );
  return (
    <article className="lodge-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-text-primary text-2xl font-bold">{encounter.title}</h2>
        <p className="text-text-muted text-xs">
          Order {encounter.encounter_order} · Leadership only
        </p>
      </div>
      <form action={strategyAction} className="mt-4">
        <input type="hidden" name="encounterId" value={encounter.id} />
        <label className="text-sm font-medium">Strategy</label>
        <textarea
          name="strategy"
          defaultValue={encounter.strategy}
          maxLength={6000}
          className="border-border bg-background mt-2 block min-h-32 w-full rounded-md border p-3 text-sm"
        />
        <button
          disabled={strategyPending}
          className="lodge-button-secondary mt-2 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {strategyPending ? 'Saving…' : 'Save strategy'}
        </button>
        <Message state={strategyState} />
      </form>
      <form action={directiveAction} className="border-border mt-6 border-t pt-5">
        <input type="hidden" name="encounterId" value={encounter.id} />
        <h3 className="text-text-primary font-medium">Add operational callout</h3>
        <p className="text-text-muted mt-1 text-xs">
          Assignments, interrupts, cooldowns, markers, and notes are separate, ordered records with
          authorship.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            name="type"
            className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="assignment">Assignment</option>
            <option value="interrupt">Interrupt</option>
            <option value="cooldown">Cooldown</option>
            <option value="marker">Marker</option>
            <option value="note">Note</option>
          </select>
          <input
            name="title"
            required
            maxLength={160}
            placeholder="Callout title"
            className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          />
          <select
            name="memberId"
            className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {guildMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {names.get(member.id)}
              </option>
            ))}
          </select>
          <input
            name="directiveOrder"
            type="number"
            min="0"
            max="1000"
            defaultValue="0"
            className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          />
          <textarea
            name="details"
            maxLength={2000}
            placeholder="Optional detail"
            className="border-border bg-background min-h-20 rounded-md border p-3 text-sm md:col-span-2"
          />
        </div>
        <button
          disabled={directivePending}
          className="lodge-button-secondary mt-3 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {directivePending ? 'Adding…' : 'Add callout'}
        </button>
        <Message state={directiveState} />
      </form>
      <ul className="mt-5 grid gap-2 md:grid-cols-2">
        {directives.map((directive) => (
          <li key={directive.id} className="lodge-list-row p-3 text-sm">
            <p className="text-accent text-xs font-medium uppercase">{directive.directive_type}</p>
            <p className="text-text-primary mt-1 font-medium">
              {directive.title}
              {directive.assigned_guild_member_id
                ? ` · ${names.get(directive.assigned_guild_member_id)}`
                : ''}
            </p>
            {directive.details && <p className="text-text-muted mt-1">{directive.details}</p>}
          </li>
        ))}
      </ul>
    </article>
  );
}
