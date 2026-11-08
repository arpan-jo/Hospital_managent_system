/**
 * The patient's bills, as the portal's My Bills page reads them from
 * `GET /hms/portal/medical-records/GetMyBills`: every bill raised at the
 * hospital for the account — the patient's own and their family members' —
 * with its items and the payments made against it. Read only: nothing is paid
 * from the portal.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { RecordPatient, toRecordPatient } from './MedicalRecordRepository';

/** As the backend names them, lower-cased; another value is kept as sent. */
export type BillPaymentStatus = 'paid' | 'partial' | 'unpaid' | string;

export interface BillItem {
  billRowId: number;
  itemName: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  /** Struck off the bill; it no longer counts. */
  isCancelled: boolean;
}

export interface BillPayment {
  paymentId: number;
  amount: number;
  /** "Cash", "Card", … as the counter recorded it. */
  method: string;
  reference: string;
  /** Bangladesh wall-clock, no zone. */
  paidAt: string;
}

export interface PortalBill extends RecordPatient {
  billId: number;
  /** "BILL-2611-0084"; '' when the bill has none. */
  billCode: string;
  /** "OPD", "Pathology", … as the counter raised it. */
  billType: string;
  /** 'YYYY-MM-DD'. */
  billDate: string;
  createdAt: string;
  subtotal: number;
  totalDiscount: number;
  billTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: BillPaymentStatus;
  isCancelled: boolean;
  isRefunded: boolean;
  doctorName: string;
  items: BillItem[];
  payments: BillPayment[];
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;
const toArray = (value: any): any[] => (Array.isArray(value) ? value : []);

const toItem = (raw: any): BillItem => ({
  billRowId: toNumber(raw?.billRowId),
  itemName: toText(raw?.itemName),
  quantity: toNumber(raw?.quantity),
  price: toNumber(raw?.price),
  discount: toNumber(raw?.discount),
  total: toNumber(raw?.total),
  isCancelled: Boolean(raw?.isCancelled),
});

const toPayment = (raw: any): BillPayment => ({
  paymentId: toNumber(raw?.paymentId),
  amount: toNumber(raw?.amount),
  method: toText(raw?.method),
  reference: toText(raw?.reference),
  paidAt: toText(raw?.paidAt),
});

export const toPortalBill = (raw: any): PortalBill => ({
  ...toRecordPatient(raw),
  billId: toNumber(raw?.billId),
  billCode: toText(raw?.billCode),
  billType: toText(raw?.billType),
  billDate: toText(raw?.billDate).slice(0, 10),
  createdAt: toText(raw?.createdAt),
  subtotal: toNumber(raw?.subtotal),
  totalDiscount: toNumber(raw?.totalDiscount),
  billTotal: toNumber(raw?.billTotal),
  paidAmount: toNumber(raw?.paidAmount),
  // As sent — the portal sums and shows the server's figure untouched.
  dueAmount: toNumber(raw?.dueAmount),
  paymentStatus: toText(raw?.paymentStatus).toLowerCase(),
  isCancelled: Boolean(raw?.isCancelled),
  isRefunded: Boolean(raw?.isRefunded),
  doctorName: toText(raw?.doctorName),
  items: toArray(raw?.items).map(toItem),
  payments: toArray(raw?.payments).map(toPayment),
});

/** What is still owed across the account — a cancelled bill owes nothing. */
export const totalDueOf = (bills?: PortalBill[] | null): number =>
  (bills ?? []).reduce((sum, bill) => sum + (bill?.isCancelled ? 0 : bill?.dueAmount ?? 0), 0);

export const BillsRepository = {
  /** `GET GetMyBills` — the account's bills, newest first. A non-list answer is a failure. */
  getBills: async (): Promise<PortalBill[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalBills,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected bills response');
    return response.map(toPortalBill).filter(bill => bill.billId > 0);
  },
};

export default BillsRepository;
