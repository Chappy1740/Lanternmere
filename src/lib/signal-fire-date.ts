// Reuse locale formatters across rows and requests; no account data is cached.
let reportDate: Intl.DateTimeFormat | undefined;
let conversationDate: Intl.DateTimeFormat | undefined;

export function formatSignalFireDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  reportDate ??= new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
  return reportDate.format(date);
}

export function formatSignalFireDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  conversationDate ??= new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  return conversationDate.format(date);
}
