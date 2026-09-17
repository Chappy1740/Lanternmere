'use client';

import { useActionState } from 'react';
import { addCharacter, type AddCharacterState } from './actions';

const initialState: AddCharacterState = { error: null };

const inputClass =
  'rounded-md border border-border bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-accent';

export default function AddCharacterPage() {
  const [state, formAction, isPending] = useActionState(addCharacter, initialState);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-text-primary text-3xl font-bold">Add a Character</h1>

      <p className="text-text-muted mt-2">
        Find a Retail World of Warcraft character using their region, realm, and name.
      </p>

      <form action={formAction} className="mt-8">
        <fieldset disabled={isPending} className="flex flex-col gap-6">
          <legend className="sr-only">Character details</legend>

          <div className="flex flex-col gap-2">
            <label htmlFor="region" className="text-text-primary text-sm">
              Region
            </label>
            <select id="region" name="region" defaultValue="us" className={inputClass}>
              <option value="us">Americas and Oceania</option>
              <option value="eu">Europe</option>
              <option value="kr">Korea</option>
              <option value="tw">Taiwan</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="realm" className="text-text-primary text-sm">
              Realm
            </label>
            <input
              id="realm"
              name="realm"
              type="text"
              required
              placeholder="Stormrage"
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="characterName" className="text-text-primary text-sm">
              Character name
            </label>
            <input
              id="characterName"
              name="characterName"
              type="text"
              required
              placeholder="Wrenx"
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>

          <p className="text-text-muted text-sm">
            Profile data comes from Blizzard. Adding a public character does not verify ownership of
            that character.
          </p>

          <button
            type="submit"
            className="bg-accent text-background hover:bg-accent-hover self-start rounded-md px-5 py-2.5 font-medium disabled:opacity-60"
          >
            {isPending ? 'Finding and saving...' : 'Add Character'}
          </button>
        </fieldset>

        <div aria-live="polite" className="mt-4">
          {state.error && (
            <p role="alert" className="text-sm text-red-400">
              {state.error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
