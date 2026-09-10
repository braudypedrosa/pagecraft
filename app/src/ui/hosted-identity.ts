export function projectIdentity(documentName: string, hostedName?: string, wordpress = false) {
  return !wordpress && hostedName ? hostedName : documentName;
}

/** Reuse the account rename contract; a redirected validation/login page is not success. */
export async function renameHostedSite(siteId: string, value: string, fetcher = fetch) {
  const name = value.trim();
  if (!name || name.length > 120) throw new Error('Use a site name between 1 and 120 characters.');
  const path = '/sites/' + encodeURIComponent(siteId) + '/settings/name';
  const response = await fetcher(path, { method: 'POST', credentials: 'same-origin', body: new URLSearchParams({ name }) });
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const error = doc.querySelector('.notice.error');
  if (error) throw new Error(error.textContent || 'The site name could not be saved.');
  if (!response.ok || !doc.querySelector('.notice[role="status"]') ||
    new URL(response.url, location.href).pathname !== path.replace(/\/name$/, '')) {
    throw new Error('The site name could not be saved. Check your connection and sign-in, then try again.');
  }
  return name;
}
