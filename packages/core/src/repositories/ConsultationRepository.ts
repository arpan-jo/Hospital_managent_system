/**
 * `GET /api/consultations/{appointmentId}` — what the doctor recorded during a
 * visit: the diagnosis and advice, the vitals taken, what was prescribed and
 * what was ordered.
 *
 * Keyed by the appointment, not by an id of its own, so any screen holding an
 * appointment can read it. Only the read is here: the writing happens on the
 * Doctor Desk, which is not on the API yet.
 *
 * The payload also carries `sectionEntries` and `fieldAnswers` — the Clinical
 * Workstation's dynamic sections, which mean nothing without the setup tables
 * that define them. They are left unmapped until the screen that needs them.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** Every reading is free text — the API stores them as typed-in. */
export interface ConsultationVitals {
  /** e.g. '120/80'. */
  bloodPressure: string;
  /** Beats per minute. */
  heartRate: string;
  /** °C. */
  temperature: string;
  /** Breaths per minute. */
  respiratoryRate: string;
  /** %. */
  oxygenSaturation: string;
  /** kg. */
  weight: string;
  /** cm. */
  height: string;
}

export interface ConsultationExamination {
  id: string;
  /** Body system examined, e.g. 'Respiratory'. */
  system: string;
  finding: string;
}

export interface ConsultationPrescription {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/** How soon the test should be run. */
export type TestPriority = 'routine' | 'urgent' | 'stat';

export const TEST_PRIORITIES: TestPriority[] = ['routine', 'urgent', 'stat'];

export interface ConsultationTestOrder {
  id: string;
  testName: string;
  category: string;
  priority: TestPriority;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  diagnosis: string;
  notes: string;
  doctorAdvice: string;
  /** 'YYYY-MM-DD'; '' when none was set. */
  followUpDate: string;
  /** Set once the doctor closed the visit. */
  completedAt: string;
  /** null until any vitals are recorded. */
  vitals: ConsultationVitals | null;
  examinations: ConsultationExamination[];
  prescriptions: ConsultationPrescription[];
  testOrders: ConsultationTestOrder[];
}

const toText = (value: any): string => String(value ?? '').trim();

/** Anything the API has not seen before is treated as an ordinary test. */
const toPriority = (raw: any): TestPriority => {
  const priority = toText(raw)?.toLowerCase() as TestPriority;
  return TEST_PRIORITIES?.includes(priority) ? priority : 'routine';
};

/** `vitals` is null until something is taken; an all-blank row reads the same. */
const toVitals = (raw: any): ConsultationVitals | null => {
  if (!raw) return null;

  const vitals: ConsultationVitals = {
    bloodPressure: toText(raw?.bloodPressure),
    heartRate: toText(raw?.heartRate),
    temperature: toText(raw?.temperature),
    respiratoryRate: toText(raw?.respiratoryRate),
    oxygenSaturation: toText(raw?.oxygenSaturation),
    weight: toText(raw?.weight),
    height: toText(raw?.height),
  };

  return Object.values(vitals).some(Boolean) ? vitals : null;
};

const toConsultation = (raw: any): Consultation => ({
  id: toText(raw?.consultationId),
  appointmentId: toText(raw?.appointmentId),
  diagnosis: toText(raw?.diagnosis),
  notes: toText(raw?.consultationNotes),
  doctorAdvice: toText(raw?.doctorAdvice),
  followUpDate: toText(raw?.followUpDate)?.slice(0, 10) ?? '',
  completedAt: toText(raw?.completedAt),
  vitals: toVitals(raw?.vitals),
  examinations: Array.isArray(raw?.examinations)
    ? raw.examinations.map((item: any) => ({
        id: toText(item?.examinationId),
        system: toText(item?.system),
        finding: toText(item?.finding),
      }))
    : [],
  prescriptions: Array.isArray(raw?.prescriptions)
    ? raw.prescriptions.map((item: any) => ({
        id: toText(item?.prescriptionId),
        medicine: toText(item?.medicine),
        dosage: toText(item?.dosage),
        frequency: toText(item?.frequency),
        duration: toText(item?.duration),
        instructions: toText(item?.instructions),
      }))
    : [],
  testOrders: Array.isArray(raw?.testOrders)
    ? raw.testOrders.map((item: any) => ({
        id: toText(item?.testOrderId),
        testName: toText(item?.testName),
        category: toText(item?.category),
        priority: toPriority(item?.priority),
      }))
    : [],
});

export const ConsultationRepository = {
  /**
   * Answers null for an appointment nobody has consulted on yet — the caller
   * shows nothing rather than an empty record, exactly as the web portal does.
   */
  getConsultation: async (
    appointmentId: string | number,
  ): Promise<Consultation | null> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.consultations}/${encodeURIComponent(
        String(appointmentId ?? ''),
      )}`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return response?.consultationId ? toConsultation(response) : null;
  },
};

export default ConsultationRepository;
