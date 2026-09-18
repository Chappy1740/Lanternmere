import Link from 'next/link';
import { BookOpen, CalendarDays, Trophy } from 'lucide-react';
import { getViewer, getLodgeMemberships } from '@/lib/hearth/context';
import { loadLodgeActivity, activityDate, excerpt } from '@/lib/hearth/activity';

export async function LodgeActivity({ lodgeId }: { lodgeId: string }) {
  const [{ supabase }, memberships] = await Promise.all([getViewer(), getLodgeMemberships()]);
  if (!memberships.some((membership) => membership.lodge_id === lodgeId)) return null;
  const { events, achievements, chronicles } = await loadLodgeActivity(supabase, lodgeId);
  const sectionClass = 'lodge-panel min-w-0 p-5 sm:p-6';
  const headingClass = 'font-display text-text-primary flex items-center gap-2 text-xl font-bold';
  const listClass = 'mt-4 space-y-5';
  const titleClass = 'text-text-primary font-medium break-words';
  const textClass = 'text-text-muted mt-2 text-sm break-words';
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-labelledby="events-heading" className={sectionClass}>
        <p className="lodge-kicker">Gather next</p>
        <h2 id="events-heading" className={headingClass}>
          <CalendarDays className="text-accent" size={18} aria-hidden="true" />
          Upcoming events
        </h2>
        {events.state === 'error' ? (
          <p className={textClass}>Events could not be loaded. Please try again later.</p>
        ) : events.rows.length === 0 ? (
          <p className={textClass}>
            Nothing is on the calendar yet. There is time to rest by the fire before the next
            adventure.
          </p>
        ) : (
          <>
            <p className={textClass}>
              Today and onward (UTC). Event times are shown as recorded; no timezone is specified.
            </p>
            <ul className={listClass}>
              {events.rows.map((event) => (
                <li key={event.id} className="lodge-list-row p-4">
                  <Link
                    href={`/quest-board/${event.id}?lodge=${lodgeId}`}
                    className={`${titleClass} hover:text-accent underline-offset-4 hover:underline`}
                  >
                    {event.title.trim() || 'Lodge event'}
                  </Link>
                  <p className={textClass}>
                    <time dateTime={event.event_date}>{activityDate(event.event_date)}</time>
                    {event.event_time
                      ? ` · ${event.event_time.slice(0, 5)}`
                      : ' · Time to be arranged'}
                  </p>
                  {[event.activity_type, event.difficulty].filter(Boolean).length > 0 && (
                    <p className={textClass}>
                      {[event.activity_type, event.difficulty].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href={`/quest-board?lodge=${lodgeId}`}
              className="text-accent hover:text-accent-hover mt-5 inline-block text-sm underline underline-offset-4"
            >
              Visit the Quest Board
            </Link>
          </>
        )}
      </section>
      <section aria-labelledby="achievements-heading" className={sectionClass}>
        <p className="lodge-kicker">The hall remembers</p>
        <h2 id="achievements-heading" className={headingClass}>
          <Trophy className="text-accent" size={18} aria-hidden="true" />
          Recent achievements
        </h2>
        {achievements.state === 'error' ? (
          <p className={textClass}>Achievements could not be loaded. Please try again later.</p>
        ) : achievements.rows.length === 0 ? (
          <p className={textClass}>
            No achievements have been recorded for this Lodge yet. Your shared victories will have a
            place here.
          </p>
        ) : (
          <>
            <p className={textClass}>Most recently recorded for this Lodge.</p>
            <ul className={listClass}>
              {achievements.rows.map((achievement) => (
                <li key={achievement.id} className="lodge-list-row p-4">
                  <h3 className={titleClass}>{achievement.title.trim() || 'Lodge achievement'}</h3>
                  {excerpt(achievement.description) && (
                    <p className={textClass}>{excerpt(achievement.description)}</p>
                  )}
                  <p className={textClass}>
                    {achievement.achieved_at ? 'Achieved ' : 'Recorded '}
                    <time dateTime={achievement.achieved_at || achievement.created_at}>
                      {activityDate(achievement.achieved_at || achievement.created_at)}
                    </time>{' '}
                    (UTC)
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby="chronicles-heading" className={`${sectionClass} lg:col-span-2`}>
        <p className="lodge-kicker">Stories shared</p>
        <h2 id="chronicles-heading" className={headingClass}>
          <BookOpen className="text-accent" size={18} aria-hidden="true" />
          Recent Chronicles
        </h2>
        {chronicles.state === 'error' ? (
          <p className={textClass}>Chronicles could not be loaded. Please try again later.</p>
        ) : chronicles.rows.length === 0 ? (
          <p className={textClass}>
            The Lodge&apos;s story is still unfolding. No Chronicles have been recorded yet.
          </p>
        ) : (
          <ul className={listClass}>
            {chronicles.rows.map((entry) => (
              <li key={entry.id} className="lodge-list-row p-4">
                <h3 className={titleClass}>{entry.title?.trim() || 'Untitled Chronicle'}</h3>
                <p className={textClass}>
                  {excerpt(entry.body) ||
                    (entry.image_url
                      ? 'A photo accompanies this entry.'
                      : 'No text has been added to this entry.')}
                </p>
                <p className={textClass}>
                  <time dateTime={entry.created_at}>{activityDate(entry.created_at)}</time> (UTC)
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
