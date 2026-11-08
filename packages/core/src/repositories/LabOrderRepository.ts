/**
 * Home Collection — lab tests the patient orders from the portal, as the portal
 * runs it on `/hms/portal/lab-orders`: tests picked from the hospital's own
 * list, a collector sent to the patient's address. No bill is raised here;
 * reception confirms, collects and bills as usual.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** Where an order stands, lower-cased; another value is kept as sent. */
export type LabOrderStatus = 'requested' | 'confirmed' | 'collected' | 'completed' | 'cancelled' | string;

/** The steps an order goes through, in order — a cancelled one leaves the line. */
export const LAB_ORDER_STEPS = ['requested', 'confirmed', 'collected', 'completed'] as const;

/** Still with the hospital: requested, confirmed or collected. */
export const isActiveLabOrder = (order?: { status?: string } | null): boolean =>
  ['requested', 'confirmed', 'collected'].includes(order?.status ?? '');

/** Only an order the hospital has not collected yet can be called off — the backend's rule. */
export const canCancelLabOrder = (order?: { status?: string } | null): boolean =>
  ['requested', 'confirmed'].includes(order?.status ?? '');

/** A container or instrument the hospital bills with a test. */
export interface LabInstrument {
  itemId: number;
  itemName: string;
  price: number;
  /** Tests with the same key share one line (one tube for two tests); null — never shared. */
  shareKey: string | null;
}

/** One test on the hospital's list. */
export interface LabTestItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  price: number;
  kind: 'pathology' | 'radiology';
  /** Empty on an older backend. */
  instruments: LabInstrument[];
}

export interface LabOrderItem {
  itemId: number;
  itemName: string;
  price: number;
  /** pathology, radiology — or instrument, for a container or instrument line. */
  kind: string;
}

export interface LabOrderEvent {
  eventId: number;
  /** patient, staff or system. */
  actorType: string;
  /** created, status, assigned, bill — or sms, which the portal does not show. */
  eventType: string;
  status: string;
  note: string;
  /** Bangladesh wall-clock, no zone. */
  createdAt: string;
}

export interface LabOrder {
  orderId: number;
  status: LabOrderStatus;
  /** home or hospital. */
  collectionType: string;
  address: string;
  phone: string;
  /** 'YYYY-MM-DD'; '' when none was asked for. */
  preferredDate: string;
  /** One of the time slots' values ('08:00-11:00'), or as sent. */
  preferredTime: string;
  note: string;
  /** The hospital's note to the patient. */
  staffNote: string;
  totalAmount: number;
  homeCollectionFee: number;
  feeItemName: string;
  /** The bill raised for it; null until reception bills it. */
  billId: number | null;
  collectorName: string;
  /** Bangladesh wall-clock, no zone; '' until a visit is set. */
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  items: LabOrderItem[];
  events: LabOrderEvent[];
  patientRegistrationId: number;
  patientName: string;
  patientCode: string;
  patientPhone: string;
}

/** The charge the hospital adds to a home collection — 0 when none is set. */
export interface HomeCollectionInfo {
  fee: number;
  feeItemName: string;
}

export interface CreateLabOrderInput {
  patientRegistrationId: number;
  itemIds: number[];
  collectionType: 'home' | 'hospital';
  address?: string | null;
  phone?: string | null;
  /** 'YYYY-MM-DD'. */
  preferredDate?: string | null;
  preferredTime?: string | null;
  note?: string | null;
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;
const toArray = (value: any): any[] => (Array.isArray(value) ? value : []);
/** A text the writer wrote over lines — only its ends are trimmed. */
const toBlock = (value: any): string => String(value ?? '').trim();

const toInstrument = (raw: any): LabInstrument => ({
  itemId: toNumber(raw?.itemId),
  itemName: toText(raw?.itemName),
  price: toNumber(raw?.price),
  shareKey: raw?.shareKey === null || raw?.shareKey === undefined || raw?.shareKey === '' ? null : toText(raw.shareKey),
});

export const toLabTestItem = (raw: any): LabTestItem => ({
  itemId: toNumber(raw?.itemId),
  itemName: toText(raw?.itemName),
  itemCode: toText(raw?.itemCode),
  price: toNumber(raw?.price),
  kind: toText(raw?.kind).toLowerCase() === 'radiology' ? 'radiology' : 'pathology',
  instruments: toArray(raw?.instruments).map(toInstrument).filter(line => line.itemId > 0),
});

const toOrderItem = (raw: any): LabOrderItem => ({
  itemId: toNumber(raw?.itemId),
  itemName: toText(raw?.itemName),
  price: toNumber(raw?.price),
  kind: toText(raw?.kind).toLowerCase(),
});

const toEvent = (raw: any): LabOrderEvent => ({
  eventId: toNumber(raw?.eventId),
  actorType: toText(raw?.actorType).toLowerCase(),
  eventType: toText(raw?.eventType).toLowerCase(),
  status: toText(raw?.status).toLowerCase(),
  note: toBlock(raw?.note),
  createdAt: toText(raw?.createdAt),
});

export const toLabOrder = (raw: any): LabOrder => {
  const billId = toNumber(raw?.billId);
  return {
    orderId: toNumber(raw?.orderId),
    status: toText(raw?.status).toLowerCase(),
    collectionType: toText(raw?.collectionType).toLowerCase(),
    address: toBlock(raw?.address),
    phone: toText(raw?.phone),
    preferredDate: toText(raw?.preferredDate).slice(0, 10),
    preferredTime: toText(raw?.preferredTime),
    note: toBlock(raw?.note),
    staffNote: toBlock(raw?.staffNote),
    totalAmount: toNumber(raw?.totalAmount),
    homeCollectionFee: toNumber(raw?.homeCollectionFee),
    feeItemName: toText(raw?.feeItemName),
    billId: billId > 0 ? billId : null,
    collectorName: toText(raw?.collectorName),
    scheduledAt: toText(raw?.scheduledAt),
    createdAt: toText(raw?.createdAt),
    updatedAt: toText(raw?.updatedAt),
    items: toArray(raw?.items).map(toOrderItem),
    events: toArray(raw?.events).map(toEvent),
    patientRegistrationId: toNumber(raw?.patientRegistrationId),
    patientName: toText(raw?.patientName),
    patientCode: toText(raw?.patientCode),
    patientPhone: toText(raw?.patientPhone),
  };
};

/** The order's instrument lines — every picked test's, a shared one once. The backend's own rule. */
export const mergeInstruments = (tests: LabTestItem[] | null | undefined): LabInstrument[] => {
  const seen = new Set<string>();
  return (tests ?? [])
    .flatMap(test => test?.instruments ?? [])
    .filter(line => {
      if (line?.shareKey === null || line?.shareKey === undefined) return true;
      if (seen.has(line.shareKey)) return false;
      seen.add(line.shareKey);
      return true;
    });
};

/**
 * What an order will come to, as the portal adds it up: the tests, their
 * instruments, and the home-collection charge — the charge only once a test is picked.
 */
export const labOrderTotals = (
  tests: LabTestItem[] | null | undefined,
  fee: number | null | undefined,
): { tests: number; instruments: number; fee: number; total: number; lines: LabInstrument[] } => {
  const picked = tests ?? [];
  const lines = mergeInstruments(picked);
  const testsTotal = picked.reduce((sum, test) => sum + (test?.price ?? 0), 0);
  const instrumentsTotal = lines.reduce((sum, line) => sum + (line?.price ?? 0), 0);
  const charge = picked.length > 0 ? Math.max(0, Number(fee ?? 0) || 0) : 0;
  return {
    tests: testsTotal,
    instruments: instrumentsTotal,
    fee: charge,
    total: testsTotal + instrumentsTotal + charge,
    lines,
  };
};

export const LabOrderRepository = {
  /** `GET GetInfo` — the home-collection charge for this registration's hospital. */
  getInfo: async (patientRegistrationId: number): Promise<HomeCollectionInfo> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalLabOrderInfo,
      method: 'GET',
      baseUrl: API_URL,
      params: { patientRegistrationId: toNumber(patientRegistrationId) },
    };
    const response = await apiRequest<any>(api_params);
    return { fee: Math.max(0, toNumber(response?.fee)), feeItemName: toText(response?.feeItemName) };
  },

  /** `GET GetTestItems` — the hospital's tests by name, 50 at most; a search narrows them. */
  getTestItems: async (patientRegistrationId: number, search?: string): Promise<LabTestItem[]> => {
    const term = toText(search);
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalLabTestItems,
      method: 'GET',
      baseUrl: API_URL,
      params: {
        patientRegistrationId: toNumber(patientRegistrationId),
        ...(term ? { search: term } : {}),
      },
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected lab test items response');
    return response.map(toLabTestItem).filter(item => item.itemId > 0);
  },

  /**
   * `POST Create` — 400 with the reason (no test, no address, a test no longer
   * offered); the server's words come with it. Answers with the order.
   */
  create: async (input: CreateLabOrderInput): Promise<LabOrder> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalLabOrderCreate,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        patientRegistrationId: toNumber(input?.patientRegistrationId),
        itemIds: (input?.itemIds ?? []).map(toNumber).filter(id => id > 0),
        collectionType: input?.collectionType === 'hospital' ? 'hospital' : 'home',
        address: input?.address ?? null,
        phone: input?.phone || null,
        preferredDate: input?.preferredDate || null,
        preferredTime: input?.preferredTime || null,
        note: input?.note || null,
      },
    };
    const response = await apiRequest<any>(api_params);
    return toLabOrder(response);
  },

  /** `GET GetMyOrders` — every order on the account, newest first. A non-list answer is a failure. */
  getMyOrders: async (): Promise<LabOrder[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalLabOrders,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected lab orders response');
    return response.map(toLabOrder).filter(order => order.orderId > 0);
  },

  /** `PATCH Cancel` — a requested or confirmed order only; 400 with the reason otherwise. */
  cancel: async (orderId: number): Promise<LabOrder | null> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalLabOrderCancel,
      method: 'PATCH',
      baseUrl: API_URL,
      params: { orderId: toNumber(orderId) },
    };
    const response = await apiRequest<any>(api_params);
    return toNumber(response?.orderId) ? toLabOrder(response) : null;
  },
};

export default LabOrderRepository;
