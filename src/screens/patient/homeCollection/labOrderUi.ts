/** How Home Collection reads on screen — the list, an order, and the booking. */
import { LabOrder, LabOrderEvent, toISODate } from '@app/core';

/**
 * The portal's three visit windows. The value is what the backend stores and
 * the hospital reads, so it is sent exactly as the portal sends it.
 */
export const LAB_ORDER_SLOTS = [
  { value: '08:00-11:00', labelKey: 'homeCollection.slot.morning', hintKey: 'homeCollection.slot.morningHint', icon: 'weather-sunset-up' },
  { value: '12:00-15:00', labelKey: 'homeCollection.slot.afternoon', hintKey: 'homeCollection.slot.afternoonHint', icon: 'weather-sunny' },
  { value: '16:00-19:00', labelKey: 'homeCollection.slot.evening', hintKey: 'homeCollection.slot.eveningHint', icon: 'weather-sunset-down' },
] as const;

export const STATUS_LABEL_KEY: Record<string, string> = {
  requested: 'homeCollection.status.requested',
  confirmed: 'homeCollection.status.confirmed',
  collected: 'homeCollection.status.collected',
  completed: 'homeCollection.status.completed',
  cancelled: 'homeCollection.status.cancelled',
};

/** "Morning (8–11 AM)" for a slot's value; a value the app does not know is shown as sent. */
export const slotLabel = (value: string | null | undefined, t: (key: string) => string): string => {
  if (!value) return '';
  const slot = LAB_ORDER_SLOTS.find(item => item.value === value);
  return slot ? `${t(slot.labelKey)} (${t(slot.hintKey)})` : value;
};

/** The tests an order is for, as the portal names it: the first two, then "+N". Instruments are not tests. */
export const orderTitle = (order: LabOrder | null | undefined): string => {
  const names = (order?.items ?? [])
    .filter(item => item?.kind !== 'instrument')
    .map(item => item?.itemName)
    .filter(Boolean);
  if (!names.length) return '';
  return `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`;
};

/** What a timeline entry reads as, as the portal words it. */
export const eventLabel = (event: LabOrderEvent | null | undefined, t: (key: string) => string): string => {
  switch (event?.eventType) {
    case 'status':
      return STATUS_LABEL_KEY[event?.status ?? ''] ? t(STATUS_LABEL_KEY[event?.status ?? '']) : event?.status ?? '';
    case 'assigned':
      return t('homeCollection.event.assigned');
    case 'bill':
      return t('homeCollection.event.bill');
    default:
      return t('homeCollection.event.created');
  }
};

/** The timeline the portal shows — every entry but the SMS ones. */
export const visibleEvents = (order: LabOrder | null | undefined): LabOrderEvent[] =>
  (order?.events ?? []).filter(event => event?.eventType !== 'sms');

/** Tomorrow and the day after, as the booking's quick picks — 'YYYY-MM-DD'. */
export const quickDates = (now = new Date()): { tomorrow: string; dayAfter: string } => ({
  tomorrow: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
  dayAfter: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)),
});
