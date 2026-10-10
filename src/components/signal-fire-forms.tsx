'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  replyToFeedback,
  setFeedbackStatus,
  submitFeedback,
  type FeedbackFormState,
} from '@/app/(app)/signal-fire/actions';

const initialState: FeedbackFormState = { error: null };

export function NewFeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedback, initialState);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pageContext, setPageContext] = useState('');
  return (
    <form action={action} className="lodge-panel space-y-5 p-5 sm:p-7">
      <label className="block text-sm font-medium">
        What are you sending?
        <select name="category" required className="lodge-field mt-2 block w-full px-3 py-2">
          <option value="problem">Something is broken</option>
          <option value="idea">Idea or request</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Short title
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={5}
          maxLength={100}
          className="lodge-field mt-2 block w-full px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        What happened, or what would you like to see?
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          className="lodge-field mt-2 block w-full px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Page or feature (optional)
        <input
          name="pageContext"
          value={pageContext}
          onChange={(event) => setPageContext(event.target.value)}
          maxLength={200}
          className="lodge-field mt-2 block w-full px-3 py-2"
        />
      </label>
      <p className="text-text-muted text-sm">
        Please leave out passwords, login codes, and private account details. Only you and the
        Lanternmere owner can see this conversation. We cannot promise a reply or fix date.
      </p>
      <button
        disabled={pending}
        type="submit"
        className="lodge-button px-5 py-2 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send to Lanternmere'}
      </button>
      {state.error && (
        <p role="alert" className="text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function FeedbackReplyForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(replyToFeedback, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={formRef} action={action} className="mt-6 space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <label className="block text-sm font-medium">
        Reply
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={4}
          className="lodge-field mt-2 block w-full px-3 py-2"
        />
      </label>
      <button
        disabled={pending}
        type="submit"
        className="lodge-button px-5 py-2 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send reply'}
      </button>
      {state.error && (
        <p role="alert" className="text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-300">
          Reply sent.
        </p>
      )}
    </form>
  );
}

export function FeedbackStatusForm({ reportId, status }: { reportId: string; status: string }) {
  const [state, action, pending] = useActionState(setFeedbackStatus, initialState);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [source, setSource] = useState({ reportId, status, state });
  if (source.reportId !== reportId || source.status !== status || source.state !== state) {
    setSource({ reportId, status, state });
    setSelectedStatus(source.state !== state ? (state.savedStatus ?? selectedStatus) : status);
  }
  const router = useRouter();
  useEffect(() => {
    if (state.success && state.savedStatus) {
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="mt-5 flex flex-wrap items-end gap-3">
      <input type="hidden" name="reportId" value={reportId} />
      <label className="text-sm font-medium">
        Review state
        <select
          name="status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          disabled={pending}
          className="lodge-field mt-2 block min-w-40 px-3 py-2"
        >
          <option value="new">New</option>
          <option value="reviewing">Reviewing</option>
          <option value="planned">Planned</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <button
        disabled={pending}
        type="submit"
        className="lodge-button-secondary px-4 py-2 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save status'}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-red-300">
          {state.error}
        </p>
      )}
      {state.success && state.savedStatus === selectedStatus && (
        <p role="status" className="w-full text-green-300">
          Status saved.
        </p>
      )}
    </form>
  );
}
