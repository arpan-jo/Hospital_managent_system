/** How a bill reads on screen — shared by the list and the bill's own page. */
import { PortalBill } from '@app/core';
import { BadgeTone } from '../reports/RecordListSection';

const STATUS_KEY: Record<string, string> = {
  paid: 'bills.status.paid',
  partial: 'bills.status.partial',
  unpaid: 'bills.status.unpaid',
};

/**
 * The bill's standing as a label key — cancelled and refunded first, as the
 * portal puts them; '' for a payment status this app does not know, which the
 * caller shows as sent.
 */
export const billStatusKey = (bill?: PortalBill | null): string => {
  if (bill?.isCancelled) return 'bills.status.cancelled';
  if (bill?.isRefunded) return 'bills.status.refunded';
  return STATUS_KEY[bill?.paymentStatus ?? ''] ?? '';
};

/** Grey once cancelled, the brand colour when paid, amber while money is owed. */
export const billStatusTone = (bill?: PortalBill | null): BadgeTone => {
  if (bill?.isCancelled) return 'muted';
  return bill?.paymentStatus === 'paid' ? 'brand' : 'warn';
};

/** A bill owes money until paid in full — never once cancelled. */
export const isBillDue = (bill?: PortalBill | null): boolean =>
  !bill?.isCancelled && (bill?.dueAmount ?? 0) > 0;

/** What a bill is found by, as on the portal: its code, its doctor, and every item on it. */
export const billSearch = (bill: PortalBill) => [
  bill?.billCode,
  bill?.doctorName,
  ...(bill?.items ?? []).map(item => item?.itemName),
];

/** How much of the bill is paid, 0 to 1 — for the bar on the bill's page. */
export const paidShare = (bill?: PortalBill | null): number => {
  const total = Number(bill?.billTotal ?? 0) || 0;
  if (total <= 0) return 0;
  const share = (Number(bill?.paidAmount ?? 0) || 0) / total;
  return Math.min(Math.max(share, 0), 1);
};

/** An icon for how a payment was made; a method this app does not know gets a plain cash one. */
export const paymentIcon = (method?: string | null): string => {
  const text = String(method ?? '').toLowerCase();
  if (/card|visa|master|amex/.test(text)) return 'credit-card-outline';
  if (/bkash|nagad|rocket|upay|mobile|mfs/.test(text)) return 'cellphone';
  if (/bank|cheque|check|transfer|eft|npsb/.test(text)) return 'bank-outline';
  return 'cash';
};
