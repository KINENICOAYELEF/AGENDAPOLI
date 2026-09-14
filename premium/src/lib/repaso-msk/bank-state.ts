import type { BankVersion } from './catalog';

type BankState = { activeId?: string; used?: boolean; seenFamilies?: string[] };
export type Marker = { activeId?: string; usedBank?: boolean; banks?: Partial<Record<BankVersion, BankState>> };
// Preserve legacy knee attempts without rewriting or deleting them.
export function readBankState(state: Marker | undefined, version: BankVersion): BankState {
  return state?.banks?.[version] ?? (version === 'knee-v1'
    ? { activeId: state?.activeId, used: !!state?.usedBank }
    : { activeId: undefined, used: false });
}
// The previous release always assigned all 35 original questions at once.
export function seenFamilies(state: Marker | undefined, version: BankVersion): string[] {
  const bank = readBankState(state, version);
  if (Array.isArray(bank.seenFamilies)) return bank.seenFamilies;
  return bank.used && version !== 'shoulder-v1'
    ? Array.from({ length: 35 }, (_, i) => `${version}-${String(i + 1).padStart(2, '0')}`) : [];
}
