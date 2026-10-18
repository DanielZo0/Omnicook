export type FailedLinkReport = { source: string; message: string };

export function importReportRecipient(configured: string | undefined): string {
  return configured?.trim() || 'danzammit1@gmail.com';
}

export function failedLinkReport(source: string, message: string): FailedLinkReport | null {
  try {
    const url = new URL(source.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { source: source.trim(), message };
  } catch {
    return null;
  }
}

export function buildImportReportEmail(recipient: string, report: FailedLinkReport, note: string): string | null {
  const email = recipient.trim();
  if (!/^[A-Za-z0-9.!#$%&'*+/=_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)) return null;
  const body = [
    'Please review this recipe link for the Omnicook extraction pipeline.',
    '', `Recipe link: ${report.source}`, '', `Import error: ${report.message}`,
    '', `My note: ${note.trim() || '(none)'}`,
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent('Omnicook: failed recipe link')}&body=${encodeURIComponent(body)}`;
}
