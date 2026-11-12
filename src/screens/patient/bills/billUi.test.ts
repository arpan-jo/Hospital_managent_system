import { PortalBill } from '@app/core';
import { billSearch, billStatusKey, billStatusTone, isBillDue, paidShare, paymentIcon } from './billUi';

jest.mock('@app/core', () => ({}));
jest.mock('../reports/RecordListSection', () => ({}));

const bill = (fields: Partial<PortalBill>): PortalBill => ({
  billId: 1,
  billCode: 'OPD-1',
  billType: 'OPD',
  billDate: '2026-11-07',
  createdAt: '',
  subtotal: 1000,
  totalDiscount: 0,
  billTotal: 1000,
  paidAmount: 0,
  dueAmount: 1000,
  paymentStatus: 'unpaid',
  isCancelled: false,
  isRefunded: false,
  doctorName: 'Dr. Nabid Alam',
  items: [],
  payments: [],
  patientRegistrationId: 1,
  patientName: 'Al Amin',
  patientCode: 'P-1',
  ...fields,
});

describe('billStatusKey / billStatusTone', () => {
  it('names cancelled and refunded first', () => {
    expect(billStatusKey(bill({ isCancelled: true, paymentStatus: 'paid' }))).toBe('bills.status.cancelled');
    expect(billStatusKey(bill({ isRefunded: true, paymentStatus: 'paid' }))).toBe('bills.status.refunded');
  });

  it('names a known payment status, and leaves an unknown one to the caller', () => {
    expect(billStatusKey(bill({ paymentStatus: 'partial' }))).toBe('bills.status.partial');
    expect(billStatusKey(bill({ paymentStatus: 'waived' }))).toBe('');
    expect(billStatusKey(null)).toBe('');
  });

  it('colours as the portal does', () => {
    expect(billStatusTone(bill({ isCancelled: true }))).toBe('muted');
    expect(billStatusTone(bill({ paymentStatus: 'paid' }))).toBe('brand');
    expect(billStatusTone(bill({ paymentStatus: 'partial' }))).toBe('warn');
  });
});

describe('isBillDue', () => {
  it('is due while money is owed, never once cancelled', () => {
    expect(isBillDue(bill({ dueAmount: 200 }))).toBe(true);
    expect(isBillDue(bill({ dueAmount: 0 }))).toBe(false);
    expect(isBillDue(bill({ dueAmount: 200, isCancelled: true }))).toBe(false);
    expect(isBillDue(undefined)).toBe(false);
  });
});

describe('paidShare', () => {
  it('is the settled part of the total, held between 0 and 1', () => {
    expect(paidShare(bill({ billTotal: 1000, paidAmount: 250, dueAmount: 750 }))).toBe(0.25);
    expect(paidShare(bill({ billTotal: 1000, paidAmount: 1000, dueAmount: 0 }))).toBe(1);
    expect(paidShare(bill({ billTotal: 1000, paidAmount: 1500, dueAmount: -500 }))).toBe(1);
    expect(paidShare(bill({ billTotal: 1000, dueAmount: 1500 }))).toBe(0);
    expect(paidShare(bill({ billTotal: 0, paidAmount: 0, dueAmount: 0 }))).toBe(0);
    expect(paidShare(null)).toBe(0);
  });

  it('is full for a refunded bill with nothing due, though the paid sum is short of the total', () => {
    expect(paidShare(bill({ billTotal: 1000, paidAmount: 600, dueAmount: 0, isRefunded: true }))).toBe(1);
  });
});

describe('paymentIcon', () => {
  it('knows the common methods', () => {
    expect(paymentIcon('Card')).toBe('credit-card-outline');
    expect(paymentIcon('bKash')).toBe('cellphone');
    expect(paymentIcon('Bank Transfer')).toBe('bank-outline');
    expect(paymentIcon('Cash')).toBe('cash');
    expect(paymentIcon(null)).toBe('cash');
  });
});

describe('billSearch', () => {
  it('searches the code, the doctor and the items — as the portal does', () => {
    const fields = billSearch(bill({ items: [{ itemName: 'CBC' } as PortalBill['items'][number]] }));
    expect(fields).toEqual(['OPD-1', 'Dr. Nabid Alam', 'CBC']);
  });
});
