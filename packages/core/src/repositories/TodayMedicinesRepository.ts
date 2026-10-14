/**
 * Today's Medicines, bound as the portal's panel binds it: the day's doses
 * from `/hms/prescriptions/today`, and the patient's reminder times from
 * `/hms/medicine-schedule`.
 *
 * Both routes answered 404 on the dev server when this was written — the
 * backend dropped them — so the panel shows its empty state, as the portal does.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { DEFAULT_SLOT_TIMES, MedicineSlot, MedicineSlotTimes } from '../utils/medicineSlots';

/** One medicine due today — `TodayMedicineDto`. */
export interface TodayMedicine {
  prescriptionId: number;
  medicine: string;
  dosage: string;
  formType: string;
  /** As written: "1-0-1", "1+1+1+1", "BD", "Twice daily", … */
  frequency: string;
  duration: string;
  instructions: string;
  doctorName: string;
  patientCode: string;
  patientName: string;
}

const toText = (value: any): string => String(value ?? '').trim();

const toTodayMedicine = (raw: any): TodayMedicine => ({
  prescriptionId: Number(raw?.prescriptionId ?? 0) || 0,
  medicine: toText(raw?.medicine),
  dosage: toText(raw?.dosage),
  formType: toText(raw?.formType),
  frequency: toText(raw?.frequency),
  duration: toText(raw?.duration),
  instructions: toText(raw?.instructions),
  doctorName: toText(raw?.doctorName),
  patientCode: toText(raw?.patientCode),
  patientName: toText(raw?.patientName),
});

const HH_MM = /^\d{2}:\d{2}$/;

/** The stored times, with the default for any slot the server sent without one. */
const toSlotTimes = (raw: any): MedicineSlotTimes => {
  const pick = (value: any, slot: MedicineSlot) => {
    const text = toText(value).slice(0, 5);
    return HH_MM.test(text) ? text : DEFAULT_SLOT_TIMES[slot];
  };
  return {
    morning: pick(raw?.morningTime, 'morning'),
    afternoon: pick(raw?.afternoonTime, 'afternoon'),
    evening: pick(raw?.eveningTime, 'evening'),
    night: pick(raw?.nightTime, 'night'),
  };
};

export const TodayMedicinesRepository = {
  /** `GET /hms/prescriptions/today[?patientCode=]` — one family member's, or everyone's. */
  getTodayMedicines: async (patientCode?: string | null): Promise<TodayMedicine[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.todayMedicines,
      method: 'GET',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response?.map(toTodayMedicine) ?? [] : [];
  },

  /** `GET /hms/medicine-schedule` — the patient's reminder time for each slot. */
  getSchedule: async (): Promise<MedicineSlotTimes> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.medicineSchedule,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return toSlotTimes(response);
  },

  /** `PUT /hms/medicine-schedule`, with the phone's offset from UTC as the portal sends it. */
  saveSchedule: async (times: MedicineSlotTimes): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.medicineSchedule,
      method: 'PUT',
      baseUrl: API_URL,
      data: {
        morningTime: times?.morning ?? DEFAULT_SLOT_TIMES.morning,
        afternoonTime: times?.afternoon ?? DEFAULT_SLOT_TIMES.afternoon,
        eveningTime: times?.evening ?? DEFAULT_SLOT_TIMES.evening,
        nightTime: times?.night ?? DEFAULT_SLOT_TIMES.night,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      },
    };
    await apiRequest<any>(api_params);
  },
};

export default TodayMedicinesRepository;
