/**
 * The patient's follow-ups, read as the portal reads them:
 * `GET /hms/portal/followups/GetMyFollowUps`. Not `/hms/followups` — that one
 * serves the doctor screens and names the patient from the wrong record.
 * The list is read-only; scheduling and closing a follow-up are the doctor's.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { FollowUpStatus, toFollowUpStatus } from '../utils/followUps';

/** One row — `PortalFollowUpDto`. */
export interface FollowUp {
  id: number;
  /** 0 when it was not ordered from a consultation. */
  consultationId: number;
  /** The visit it was ordered at; 0 when the link back to it is lost. */
  appointmentId: number;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 24h 'HH:mm'; '' when none was set. */
  time: string;
  status: FollowUpStatus;
  reason: string;
  /** What the doctor wrote against it. */
  notes: string;
  createdAt: string;
  /** `doctorUserId` — the doctor's employeeId, the id a doctor's page is opened by. */
  doctorId: number;
  doctorName: string;
  doctorSpecialty: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  doctorPhotoUrl: string;
  patientName: string;
  patientCode: string;
}

const toText = (value: any): string => String(value ?? '').trim();

const toId = (value: any): number => {
  const id = Number(value ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
};

const toFollowUp = (raw: any): FollowUp => ({
  id: toId(raw?.followUpId),
  consultationId: toId(raw?.consultationId),
  appointmentId: toId(raw?.appointmentId),
  date: toText(raw?.scheduledDate).slice(0, 10),
  time: toText(raw?.scheduledTime).slice(0, 5),
  status: toFollowUpStatus(raw?.status),
  reason: toText(raw?.reason),
  notes: toText(raw?.doctorNotes),
  createdAt: toText(raw?.createdAt),
  doctorId: toId(raw?.doctorUserId),
  doctorName: toText(raw?.doctorName),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
});

export const PatientFollowUpRepository = {
  /**
   * A bare array. Anything else is a failure, not an empty list — so the
   * screen says it could not load rather than "no follow-ups".
   */
  getFollowUps: async (): Promise<FollowUp[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalFollowUps,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    if (!Array.isArray(response)) {
      throw new Error('Unexpected follow-ups response');
    }
    return response?.map(toFollowUp) ?? [];
  },
};

export default PatientFollowUpRepository;
