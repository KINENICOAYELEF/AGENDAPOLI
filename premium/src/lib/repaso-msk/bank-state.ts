import type { BankVersion } from './catalog';

type Marker = { activeId?: string; usedBank?: boolean; banks?: Partial<Record<BankVersion, { activeId?: string; used?: boolean }>> };
// Preserve legacy knee attempts without rewriting or deleting them.
export function readBankState(state: Marker | undefined, version: BankVersion) {
  return state?.banks?.[version] ?? (version === 'knee-v1'
    ? { activeId: state?.activeId, used: !!state?.usedBank }
    : { activeId: undefined, used: false });
}
