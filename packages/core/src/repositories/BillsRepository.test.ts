import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { BillsRepository, PortalBill, toPortalBill, totalDueOf } from './BillsRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

const rawBill = {
  billId: 812,
  billCode: 'OPD-2026-0812',
  publicId: 'b6d1',
  billType: 'OPD',
  billDate: '2026-11-07T00:00:00',
  createdAt: '2026-11-07T10:12:00',
  subtotal: 1500,
  totalDiscount: 150,
  billTotal: 1350,
  paidAmount: 1000,
  dueAmount: 350,
  paymentStatus: 'Partial',
  isCancelled: false,
  isRefunded: false,
  doctorName: 'Dr. Nabid Alam',
  patientRegistrationId: 2367,
  patientName: 'Al Amin',
  patientCode: 'P-2367',
  items: [
    { billRowId: 1, itemName: 'CBC', quantity: 1, price: 500, discount: 50, total: 450, isCancelled: false },
    { billRowId: 2, itemName: 'X-Ray Chest', quantity: 1, price: 1000, discount: 100, total: 900, isCancelled: true },
  ],
  payments: [{ paymentId: 9, amount: 1000, method: 'Cash', reference: null, paidAt: '2026-11-07T10:15:00' }],
};

describe('BillsRepository.getBills', () => {
  beforeEach(() => request.mockReset());

  it('reads every bill with its items and payments', async () => {
    request.mockResolvedValueOnce([rawBill]);

    const bills = await BillsRepository.getBills();

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: ENDPOINTS.portalBills, method: 'GET' }));
    expect(bills).toEqual([
      {
        billId: 812,
        billCode: 'OPD-2026-0812',
        billType: 'OPD',
        billDate: '2026-11-07',
        createdAt: '2026-11-07T10:12:00',
        subtotal: 1500,
        totalDiscount: 150,
        billTotal: 1350,
        paidAmount: 1000,
        dueAmount: 350,
        paymentStatus: 'partial',
        isCancelled: false,
        isRefunded: false,
        doctorName: 'Dr. Nabid Alam',
        patientRegistrationId: 2367,
        patientName: 'Al Amin',
        patientCode: 'P-2367',
        items: [
          { billRowId: 1, itemName: 'CBC', quantity: 1, price: 500, discount: 50, total: 450, isCancelled: false },
          {
            billRowId: 2,
            itemName: 'X-Ray Chest',
            quantity: 1,
            price: 1000,
            discount: 100,
            total: 900,
            isCancelled: true,
          },
        ],
        payments: [{ paymentId: 9, amount: 1000, method: 'Cash', reference: '', paidAt: '2026-11-07T10:15:00' }],
      },
    ]);
  });

  it('survives missing lists and nulls', async () => {
    request.mockResolvedValueOnce([{ billId: 5, billCode: null, items: null, payments: undefined, dueAmount: null }]);

    const [bill] = await BillsRepository.getBills();

    expect(bill.billCode).toBe('');
    expect(bill.items).toEqual([]);
    expect(bill.payments).toEqual([]);
    expect(bill.dueAmount).toBe(0);
    expect(bill.paymentStatus).toBe('');
  });

  it('drops rows without a bill id', async () => {
    request.mockResolvedValueOnce([{ billId: 0 }, null, { billId: 3 }]);

    await expect(BillsRepository.getBills()).resolves.toHaveLength(1);
  });

  it('treats a non-list answer as a failure', async () => {
    request.mockResolvedValueOnce({ message: 'nope' });

    await expect(BillsRepository.getBills()).rejects.toThrow('Unexpected bills response');
  });
});

describe('totalDueOf', () => {
  const bill = (dueAmount: number, isCancelled = false): PortalBill =>
    ({ ...toPortalBill({ billId: 1 }), dueAmount, isCancelled });

  it('adds up what is owed, as the portal does', () => {
    expect(totalDueOf([bill(350), bill(0), bill(120.5)])).toBe(470.5);
  });

  it('leaves out cancelled bills', () => {
    expect(totalDueOf([bill(350), bill(900, true)])).toBe(350);
  });

  it('is 0 for nothing', () => {
    expect(totalDueOf([])).toBe(0);
    expect(totalDueOf(null)).toBe(0);
    expect(totalDueOf(undefined)).toBe(0);
  });
});
