/**
 * The patient's vitals, as the portal's Vitals page reads them from
 * `GET /hms/portal/medical-records/GetMyVitals`: every reading taken at the
 * desk or the ward — and, since 2026-11-08, read off a prescription the patient
 * uploaded — for the account's patients, oldest first, as the backend sorts them.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { RecordPatient, toRecordPatient } from './MedicalRecordRepository';

/** One sitting's readings. A measure that was not taken is null. */
export interface VitalsRecord extends RecordPatient {
  id: number;
  appointmentId: number;
  /** Bangladesh wall-clock, no zone. */
  recordedAt: string;
  bpSys: number | null;
  bpDia: number | null;
  pulse: number | null;
  tempCelsius: number | null;
  spo2: number | null;
  respRate: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  doctorName: string;
  /** Read off a prescription the patient uploaded, not taken at the hospital. */
  isUploaded: boolean;
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;

/** A reading as sent, or null when it was not taken — the portal shows any number it gets. */
const toReading = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const reading = Number(value);
  return Number.isFinite(reading) ? reading : null;
};

export const toVitalsRecord = (raw: any): VitalsRecord => ({
  ...toRecordPatient(raw),
  // An upload's id is the negative prescription id — kept as sent, it is only a key.
  id: Number(raw?.id ?? 0) || 0,
  appointmentId: toNumber(raw?.appointmentId),
  recordedAt: toText(raw?.recordedAt),
  bpSys: toReading(raw?.bpSys),
  bpDia: toReading(raw?.bpDia),
  pulse: toReading(raw?.pulse),
  tempCelsius: toReading(raw?.tempCelsius),
  spo2: toReading(raw?.spo2),
  respRate: toReading(raw?.respRate),
  heightCm: toReading(raw?.heightCm),
  weightKg: toReading(raw?.weightKg),
  bmi: toReading(raw?.bmi),
  doctorName: toText(raw?.doctorName),
  isUploaded: toText(raw?.source).toLowerCase() === 'patientupload',
});

export const VitalsRepository = {
  /** `GET GetMyVitals` — every sitting, oldest first, kept as the portal keeps them. A non-list answer is a failure. */
  getVitals: async (): Promise<VitalsRecord[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalVitals,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected vitals response');
    return response.map(toVitalsRecord);
  },
};

export default VitalsRepository;
