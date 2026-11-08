import apiRequest from '../network/apiRequest';
import {
  LabOrderRepository,
  LabTestItem,
  canCancelLabOrder,
  isActiveLabOrder,
  labOrderTotals,
  mergeInstruments,
} from './LabOrderRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

const labTest = (over: Partial<LabTestItem>): LabTestItem => ({
  itemId: 1,
  itemName: 'CBC',
  itemCode: '',
  price: 400,
  kind: 'pathology',
  instruments: [],
  ...over,
});

describe('mergeInstruments', () => {
  it('counts a shared tube once and an unshared line every time', () => {
    const tube = { itemId: 90, itemName: 'EDTA tube', price: 20, shareKey: 'c:90:1:2' };
    const needle = { itemId: 91, itemName: 'Needle', price: 10, shareKey: null };
    const lines = mergeInstruments([
      labTest({ itemId: 1, instruments: [tube, needle] }),
      labTest({ itemId: 2, instruments: [tube, needle] }),
    ]);
    expect(lines.map(line => line.itemName)).toEqual(['EDTA tube', 'Needle', 'Needle']);
  });

  it('is empty for nothing', () => {
    expect(mergeInstruments(null)).toEqual([]);
  });
});

describe('labOrderTotals', () => {
  it('adds the tests, their instruments and the charge', () => {
    const totals = labOrderTotals(
      [
        labTest({ price: 400, instruments: [{ itemId: 90, itemName: 'Tube', price: 20, shareKey: 'k' }] }),
        labTest({ itemId: 2, price: 600, instruments: [{ itemId: 90, itemName: 'Tube', price: 20, shareKey: 'k' }] }),
      ],
      150,
    );
    expect(totals).toMatchObject({ tests: 1000, instruments: 20, fee: 150, total: 1170 });
  });

  it('leaves the charge out until a test is picked', () => {
    expect(labOrderTotals([], 150)).toMatchObject({ fee: 0, total: 0 });
  });
});

describe('order stages', () => {
  it('knows which orders are still with the hospital and which can be called off', () => {
    expect(isActiveLabOrder({ status: 'collected' })).toBe(true);
    expect(isActiveLabOrder({ status: 'completed' })).toBe(false);
    expect(canCancelLabOrder({ status: 'confirmed' })).toBe(true);
    expect(canCancelLabOrder({ status: 'collected' })).toBe(false);
    expect(canCancelLabOrder(null)).toBe(false);
  });
});

describe('LabOrderRepository', () => {
  beforeEach(() => request.mockReset());

  it('reads the test list for a registration, with the search only when there is one', async () => {
    request.mockResolvedValueOnce([
      {
        itemId: 5,
        itemName: 'Lipid Profile',
        itemCode: null,
        price: 1200,
        kind: 'pathology',
        instruments: [{ itemId: 90, itemName: 'Tube', price: 20, shareKey: null }, { itemId: 0 }],
      },
      { itemId: 6, itemName: 'X-Ray Chest', price: 500, kind: 'Radiology' },
      { itemId: 0, itemName: 'Broken' },
    ]);

    const items = await LabOrderRepository.getTestItems(2313, '  ');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/lab-orders/GetTestItems',
        params: { patientRegistrationId: 2313 },
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0].instruments).toEqual([{ itemId: 90, itemName: 'Tube', price: 20, shareKey: null }]);
    expect(items[1]).toMatchObject({ kind: 'radiology', instruments: [] });

    request.mockResolvedValueOnce([]);
    await LabOrderRepository.getTestItems(2313, ' cbc ');
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: { patientRegistrationId: 2313, search: 'cbc' } }),
    );
  });

  it('places a home collection with the fields the portal sends', async () => {
    request.mockResolvedValueOnce({ orderId: 12, status: 'Requested', items: [], billId: null });

    const order = await LabOrderRepository.create({
      patientRegistrationId: 2313,
      itemIds: [5, 6],
      collectionType: 'home',
      address: 'House 6, Road 2',
      phone: '',
      preferredDate: '2026-11-09',
      preferredTime: '08:00-11:00',
      note: '',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/lab-orders/Create',
        method: 'POST',
        data: {
          patientRegistrationId: 2313,
          itemIds: [5, 6],
          collectionType: 'home',
          address: 'House 6, Road 2',
          phone: null,
          preferredDate: '2026-11-09',
          preferredTime: '08:00-11:00',
          note: null,
        },
      }),
    );
    expect(order).toMatchObject({ orderId: 12, status: 'requested', billId: null });
  });

  it('reads the orders and drops one without an id', async () => {
    request.mockResolvedValueOnce([
      {
        orderId: 3,
        status: 'confirmed',
        preferredDate: '2026-11-09T00:00:00',
        billId: 0,
        items: [{ itemId: 5, itemName: 'CBC', price: 400, kind: 'Instrument' }],
        events: [{ eventId: 1, eventType: 'Created', createdAt: '2026-11-08T10:00:00' }],
      },
      { orderId: 0 },
    ]);

    const orders = await LabOrderRepository.getMyOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ preferredDate: '2026-11-09', billId: null });
    expect(orders[0].items[0].kind).toBe('instrument');
    expect(orders[0].events[0].eventType).toBe('created');
  });

  it('treats an answer that is not a list as a failure', async () => {
    request.mockResolvedValueOnce({ message: 'nope' });
    await expect(LabOrderRepository.getMyOrders()).rejects.toThrow();
  });

  it('cancels by id in the query', async () => {
    request.mockResolvedValueOnce({ orderId: 3, status: 'cancelled' });

    const order = await LabOrderRepository.cancel(3);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/lab-orders/Cancel',
        method: 'PATCH',
        params: { orderId: 3 },
      }),
    );
    expect(order?.status).toBe('cancelled');
  });

  it('reads the charge, 0 when none is set', async () => {
    request.mockResolvedValueOnce({ fee: null, feeItemName: null });
    expect(await LabOrderRepository.getInfo(2313)).toEqual({ fee: 0, feeItemName: '' });
  });
});
