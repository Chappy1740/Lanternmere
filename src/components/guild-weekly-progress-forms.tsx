'use client';

import { useActionState } from 'react';
import {
  saveWeeklyReport,
  saveWeeklyRequirement,
  type ProgressState,
} from '@/app/(app)/guild-hall/progress/actions';
import type { WeeklyReport, WeeklyRequirement } from '@/lib/weekly-raider-progress';

const initial: ProgressState = { message: '', error: false };
const inputClass =
  'border-border bg-background mt-1 block min-h-11 w-full rounded-md border px-3 py-2 text-sm';
function Message({ state }: { state: ProgressState }) {
  return state.message ? (
    <p role={state.error ? 'alert' : 'status'} className="text-text-secondary mt-3 text-sm">
      {state.message}
    </p>
  ) : null;
}

export function WeeklyRequirementForm({
  guildId,
  operationId,
  region,
  resetOn,
  requirement,
}: {
  guildId: string;
  operationId: string | null;
  region: string;
  resetOn: string;
  requirement: WeeklyRequirement | null;
}) {
  const [state, action, pending] = useActionState(saveWeeklyRequirement, initial);
  return (
    <form action={action} className="lodge-panel p-5">
      <h2 className="font-display text-text-primary text-xl font-bold">
        Set this roster’s weekly target
      </h2>
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="operationId" value={operationId ?? ''} />
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="resetOn" value={resetOn} />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Mythic+ runs required
          <input
            className={inputClass}
            type="number"
            name="runs"
            min={1}
            max={50}
            required
            defaultValue={requirement?.mythic_runs_required ?? 8}
          />
        </label>
        <label className="text-sm">
          Minimum key level
          <input
            className={inputClass}
            type="number"
            name="minimumKey"
            min={2}
            max={40}
            required
            defaultValue={requirement?.minimum_key_level ?? 2}
          />
        </label>
        <label className="text-sm">
          Raid boss kills required (optional)
          <input
            className={inputClass}
            type="number"
            name="raidBosses"
            min={0}
            max={1000}
            defaultValue={requirement?.raid_bosses_required ?? ''}
          />
        </label>
      </div>
      <p className="text-text-muted mt-3 text-sm">
        This target applies only to the selected roster, region and reset week. Each selected
        character is tracked separately. Raid kills are reported boss-and-difficulty completions.
      </p>
      <button
        disabled={pending}
        className="lodge-button mt-4 min-h-11 px-4 py-2 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save weekly target'}
      </button>
      <Message state={state} />
    </form>
  );
}

export function WeeklyReportForm({
  guildId,
  guildName,
  characterId,
  characterName,
  resetOn,
  report,
  shared,
  characterShared,
  sharedElsewhere = false,
}: {
  guildId: string;
  guildName: string;
  characterId: string;
  characterName: string;
  resetOn: string;
  report: WeeklyReport | null;
  shared: boolean;
  characterShared: boolean;
  sharedElsewhere?: boolean;
}) {
  const [state, action, pending] = useActionState(saveWeeklyReport, initial);
  return (
    <details className="lodge-panel p-5">
      <summary className="text-text-primary min-h-11 cursor-pointer py-2.5 font-semibold">
        Update {characterName}’s weekly progress
      </summary>
      <form action={action} className="mt-4">
        {sharedElsewhere && (
          <p className="text-text-secondary mb-4 text-sm">
            You already share this week’s record with another Guild. That sharing also applies to
            these updates. Open that Guild’s weekly progress page to change its sharing choice.
          </p>
        )}
        <input type="hidden" name="guildId" value={guildId} />
        <input type="hidden" name="characterId" value={characterId} />
        <input type="hidden" name="resetOn" value={resetOn} />
        <p className="text-text-muted text-sm">
          Report the full current week. Blank means unknown. Enter 0 for a known zero count, or none
          for zero runs. These entries are labeled player-reported, separate from Blizzard
          observations.
        </p>
        <label className="mt-4 block text-sm">
          Completed Mythic+ run levels
          <input
            className={inputClass}
            name="runLevels"
            maxLength={400}
            placeholder="10, 10, 8, 7 — or none for zero runs"
            defaultValue={
              report?.mythic_run_levels == null
                ? ''
                : report.mythic_run_levels.length
                  ? report.mythic_run_levels.join(', ')
                  : 'none'
            }
          />
          <span className="text-text-muted mt-1 block text-xs">
            One level per completed run, including repeats and runs over time. Only levels meeting
            the roster target count toward it.
          </span>
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Weekly raid boss kills
            <input
              className={inputClass}
              type="number"
              name="bosses"
              min={0}
              max={1000}
              defaultValue={report?.weekly_raid_bosses ?? ''}
            />
          </label>
          <label className="text-sm">
            Raid Vault slots unlocked
            <input
              className={inputClass}
              type="number"
              name="raidSlots"
              min={0}
              max={3}
              defaultValue={report?.raid_vault_slots ?? ''}
            />
          </label>
          <label className="text-sm">
            Dungeon Vault slots unlocked
            <input
              className={inputClass}
              type="number"
              name="dungeonSlots"
              min={0}
              max={3}
              defaultValue={report?.dungeon_vault_slots ?? ''}
            />
          </label>
          <label className="text-sm">
            World Vault slots unlocked
            <input
              className={inputClass}
              type="number"
              name="worldSlots"
              min={0}
              max={3}
              defaultValue={report?.world_vault_slots ?? ''}
            />
          </label>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            className="mt-1 size-5 shrink-0 disabled:opacity-50"
            type="checkbox"
            name="shared"
            defaultChecked={shared}
            // Stay enabled while shared so the owner can always turn sharing off.
            disabled={!characterShared && !shared}
            aria-describedby={!characterShared ? `share-help-${characterId}` : undefined}
          />
          Share this week’s report and Vault notes with {guildName} leadership.
        </label>
        {!characterShared && (
          <p id={`share-help-${characterId}`} className="text-text-muted mt-2 text-sm">
            To enable sharing, first share this Traveler with this Guild in the Guild Hall. You can
            save privately now.
          </p>
        )}
        <p className="text-text-muted mt-2 text-xs">
          Turning this off revokes this week’s report and Vault-note sharing with this Guild. Other
          Guild choices are unchanged.
        </p>
        <button
          disabled={pending}
          className="lodge-button mt-4 min-h-11 px-4 py-2 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save my weekly progress'}
        </button>
        <Message state={state} />
      </form>
    </details>
  );
}
