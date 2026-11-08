import { LabOrder } from '@app/core';
import { eventLabel, orderTitle, quickDates, slotLabel, visibleEvents } from './labOrderUi';

// The real date helper, without loading the whole core (its stores need native storage).
jest.mock('@app/core', () => jest.requireActual('../../../../packages/core/src/utils/format'));

const t = (key: string) => key.split('.').pop() ?? key;

const order = (over: Partial<LabOrder>): LabOrder => ({ items: [], events: [], ...over } as unknown as LabOrder);

describe('slotLabel', () => {
  it('names a known window and keeps any other value as sent', () => {
    expect(slotLabel('08:00-11:00', t)).toBe('morning (morningHint)');
    expect(slotLabel('21:00-22:00', t)).toBe('21:00-22:00');
    expect(slotLabel('', t)).toBe('');
  });
});

describe('orderTitle', () => {
  it('names the first two tests and counts the rest, leaving instruments out', () => {
    const title = orderTitle(
      order({
        items: [
          { itemId: 1, itemName: 'CBC', price: 0, kind: 'pathology' },
          { itemId: 9, itemName: 'Tube', price: 0, kind: 'instrument' },
          { itemId: 2, itemName: 'ESR', price: 0, kind: 'pathology' },
          { itemId: 3, itemName: 'Lipid', price: 0, kind: 'pathology' },
          { itemId: 4, itemName: 'X-Ray', price: 0, kind: 'radiology' },
        ],
      }),
    );
    expect(title).toBe('CBC, ESR +2');
  });

  it('is empty without tests', () => {
    expect(orderTitle(null)).toBe('');
  });
});

describe('the timeline', () => {
  it('hides the SMS entries and words each kind', () => {
    const events = visibleEvents(
      order({
        events: [
          { eventId: 1, actorType: 'patient', eventType: 'created', status: '', note: '', createdAt: '' },
          { eventId: 2, actorType: 'system', eventType: 'sms', status: '', note: '', createdAt: '' },
          { eventId: 3, actorType: 'staff', eventType: 'status', status: 'confirmed', note: '', createdAt: '' },
          { eventId: 4, actorType: 'staff', eventType: 'assigned', status: '', note: '', createdAt: '' },
        ],
      }),
    );
    expect(events.map(event => eventLabel(event, t))).toEqual(['created', 'confirmed', 'assigned']);
  });
});

describe('quickDates', () => {
  it('gives tomorrow and the day after, across a month', () => {
    expect(quickDates(new Date(2026, 9, 31, 22, 0))).toEqual({ tomorrow: '2026-11-01', dayAfter: '2026-11-02' });
  });
});
