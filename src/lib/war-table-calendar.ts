export type CalendarItem = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  description: string;
  url: string;
};

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function utcStamp(date: string, time: string | null) {
  return `${date.replaceAll('-', '')}T${(time ?? '00:00').slice(0, 5).replace(':', '')}00Z`;
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      folded.push(current);
      current = ` ${character}`;
      bytes = size + 1;
    } else {
      current += character;
      bytes += size;
    }
  }
  folded.push(current);
  return folded.join('\r\n');
}

export function warTableCalendarIcs(events: CalendarItem[], calendarName: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lanternmere//War Table//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const event of events) {
    const start = new Date(`${event.date}T${event.time ?? '00:00:00'}Z`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const nextDay = new Date(`${event.date}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@lanternmere`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')}`,
      event.time
        ? `DTSTART:${utcStamp(event.date, event.time)}`
        : `DTSTART;VALUE=DATE:${event.date.replaceAll('-', '')}`,
      event.time
        ? `DTEND:${end
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '')}`
        : `DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replaceAll('-', '')}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      `URL:${event.url}`,
      'END:VEVENT',
    );
  }
  return `${lines.map(foldLine).join('\r\n')}\r\nEND:VCALENDAR\r\n`;
}
