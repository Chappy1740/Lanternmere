'use client';

import { useActionState } from 'react';
import { removeRaidbotsReport, saveRaidbotsReport, type CharacterStatusState } from './actions';

const initialState: CharacterStatusState = { error: null, success: null };

export function RaidbotsReportControl({ characterId, lodges, reports }: { characterId: string; lodges: { id: string; name: string }[]; reports: { lodge_id: string; report_url: string; upgrade_targets: string | null }[] }) {
  const [state, action, pending] = useActionState(saveRaidbotsReport, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeRaidbotsReport, initialState);
  return <section className="lodge-panel mt-6 p-6">
    <p className="lodge-kicker">Player-submitted gear plan</p>
    <h2 className="font-display text-text-primary mt-2 text-xl">Raidbots report</h2>
    <p className="text-text-muted mt-2 text-sm">Paste a completed Top Gear or Droptimizer report. Lanternmere does not submit or read simulations.</p>
    {lodges.map((lodge) => { const report = reports.find((item) => item.lodge_id === lodge.id); return <div key={lodge.id} className="border-border mt-4 border-t pt-4"><form action={action} className="grid gap-3">
      <input type="hidden" name="characterId" value={characterId} /><input type="hidden" name="lodgeId" value={lodge.id} />
      <label className="text-text-primary text-sm">Share with {lodge.name}<input required type="url" name="reportUrl" defaultValue={report?.report_url} placeholder="https://www.raidbots.com/simbot/report/..." className="lodge-input mt-1 w-full" /></label>
      <label className="text-text-primary text-sm">Upgrade targets (optional)<textarea name="upgradeTargets" defaultValue={report?.upgrade_targets ?? ''} maxLength={500} className="lodge-input mt-1 w-full" rows={2} /></label>
      <button disabled={pending} className="lodge-button-secondary w-fit px-3 py-2 text-sm">{pending ? 'Saving…' : report ? 'Update report' : 'Share report'}</button>
    </form>{report && <form action={removeAction} className="mt-3"><input type="hidden" name="characterId" value={characterId} /><input type="hidden" name="lodgeId" value={lodge.id} /><button disabled={removePending} className="text-red-400 text-sm underline underline-offset-4">Remove shared report</button></form>}</div> })}
    {state.error && <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>}
    {state.success && <p role="status" className="text-text-muted mt-3 text-sm">{state.success}</p>}
    {removeState.error && <p role="alert" className="mt-3 text-sm text-red-400">{removeState.error}</p>}
    {removeState.success && <p role="status" className="text-text-muted mt-3 text-sm">{removeState.success}</p>}
  </section>;
}
