// One source of truth for the consent sentence. The RENDERED text is snapshotted
// onto each HubDrop at creation, so changing this template can never retroactively
// alter what a member already agreed to. Mirrors the sibling Kollab app's lib/consent.ts.
const TEMPLATE = 'By dropping content you allow {hub} to feature and remix it in this community.'

export function consentTextFor(hubTitle: string): string {
  return TEMPLATE.replace('{hub}', hubTitle)
}
