'use client';

import { useActionState } from 'react';
import {
  createCampaign,
  updateCampaignProgress,
  type CampaignState,
} from '@/app/(app)/(lodge)/adventures/campaign-actions';
import type { LodgeCampaign } from '@/lib/adventures/campaigns';

const initialState: CampaignState = { error: null, success: null };

export function CampaignForm({ lodgeId }: { lodgeId: string }) {
  const [state, action, pending] = useActionState(createCampaign, initialState);
  return (
    <form action={action} className="lodge-panel p-6">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Campaign name
          <input
            name="title"
            required
            maxLength={120}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Goal or focus <span className="text-text-muted font-normal">optional</span>
          <textarea
            name="goal"
            rows={3}
            maxLength={500}
            className="lodge-field resize-y px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Progress goal <span className="text-text-muted font-normal">optional count</span>
          <input
            name="targetCount"
            type="number"
            min="1"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="lodge-button mt-5 px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Start campaign'}
      </button>
    </form>
  );
}

export function CampaignProgressControl({ campaign }: { campaign: LodgeCampaign }) {
  const [state, action, pending] = useActionState(updateCampaignProgress, initialState);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="campaignId" value={campaign.id} />
      <label className="text-text-primary flex flex-col gap-1 text-sm">
        Progress
        <input
          name="progressCount"
          type="number"
          min="0"
          max={campaign.target_count ?? undefined}
          defaultValue={campaign.progress_count}
          className="lodge-field w-24 px-2 py-1.5"
        />
      </label>
      <label className="text-text-primary flex flex-col gap-1 text-sm">
        State
        <select name="status" defaultValue={campaign.status} className="lodge-field px-2 py-1.5">
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="lodge-button-secondary px-3 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Update'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
