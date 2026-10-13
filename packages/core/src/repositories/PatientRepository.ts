import { API_URL } from '@env';
import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import FileRepository, { UploadFile } from './FileRepository';

export interface PatientProfile {
  patientProfileId: number;
  userId: number;
  patientCode: string;
  relationship: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
}

// Backend only accepts these two ('active'|'resolved') — no 'chronic' value exists in the API.
export type ConditionStatus = 'Active' | 'Resolved';
export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';

export interface MedicalCondition {
  id: string;
  name: string;
  /** ISO 'YYYY-MM-DD' — format for display with `formatLongDate` at the view. */
  diagnosedDate: string;
  status: ConditionStatus;
  notes: string;
}

export interface Allergy {
  id: string;
  name: string;
  severity: AllergySeverity;
  reaction: string;
}

export interface FamilyMember {
  id: string;
  fullName: string;
  gender: string;
  age: number;
  /** 'Myself' marks the account holder's own profile. */
  relationship: 'Myself' | 'Other';
  /** How the relative is related — 'Spouse', 'Child', … Empty for the holder. */
  relationshipLabel: string;
  patientCode: string;
  bloodType: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  photoUrl: string;
}

export const FAMILY_RELATIONSHIPS = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Other',
] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * What the profile forms collect. `relationship` is 'Self' for the account
 * holder's own profile and one of `FAMILY_RELATIONSHIPS` for a relative —
 * the API takes it lowercased (`^(self|spouse|child|parent|sibling|other)$`).
 */
export interface NewFamilyMember {
  fullName: string;
  relationship: FamilyRelationship | 'Self';
  /** Blob name returned by `FileRepository.upload` — not the display URL. */
  photoUrl?: string;
  gender: string;
  /** ISO 'YYYY-MM-DD'. */
  dateOfBirth: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export const CONDITION_STATUSES: ConditionStatus[] = ['Active', 'Resolved'];
export const ALLERGY_SEVERITIES: AllergySeverity[] = [
  'Mild',
  'Moderate',
  'Severe',
];

const toText = (value: any): string => String(value ?? '').trim();

/** 'spouse' -> 'Spouse'. The API stores relationship and gender lowercased. */
const toTitleCase = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';

/** Every string field can come back `null` — the model below is non-nullable. */
const toPatientProfile = (raw: any): PatientProfile => ({
  patientProfileId: Number(raw?.patientProfileId ?? 0),
  userId: Number(raw?.userId ?? 0),
  patientCode: toText(raw?.patientCode),
  // "self" marks the account holder's own profile; anything else is a relative.
  relationship: toText(raw?.relationship)?.toLowerCase() ?? '',
  fullName: toText(raw?.fullName),
  dateOfBirth: toText(raw?.dateOfBirth),
  // Stored either way ('Male' / 'male') — the gender dropdown matches on 'Male'.
  gender: toTitleCase(toText(raw?.gender)),
  bloodType: toText(raw?.bloodType)?.toUpperCase(),
  phone: toText(raw?.phone),
  email: toText(raw?.email),
  address: toText(raw?.address),
  emergencyContact: toText(raw?.emergencyContact),
  emergencyPhone: toText(raw?.emergencyPhone),
  photoUrl: toText(raw?.photoUrl),
  createdAt: toText(raw?.createdAt),
  updatedAt: toText(raw?.updatedAt),
});

/** The API stores status/severity lowercased; the UI works in capitalized values. */
const toConditionStatus = (raw: any): ConditionStatus =>
  toText(raw)?.toLowerCase() === 'resolved' ? 'Resolved' : 'Active';

const toAllergySeverity = (raw: any): AllergySeverity => {
  const value = toText(raw)?.toLowerCase();
  if (value === 'moderate') return 'Moderate';
  if (value === 'severe') return 'Severe';
  return 'Mild';
};

const toMedicalCondition = (raw: any): MedicalCondition => ({
  id: String(raw?.medicalHistoryId ?? ''),
  name: toText(raw?.condition),
  diagnosedDate: toText(raw?.diagnosedDate),
  status: toConditionStatus(raw?.status),
  notes: toText(raw?.notes),
});

const toAllergy = (raw: any): Allergy => ({
  id: String(raw?.allergyId ?? ''),
  name: toText(raw?.allergen),
  severity: toAllergySeverity(raw?.severity),
  reaction: toText(raw?.reaction),
});

/** Calculates age in full years from a 'YYYY-MM-DD' date-of-birth string. */
const calcAge = (dob: string): number => {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/** Maps a PatientProfile from the API to the FamilyMember shape the UI expects. */
const profileToFamilyMember = (profile: PatientProfile): FamilyMember => ({
  id: profile?.patientCode || String(profile?.patientProfileId ?? ''),
  fullName: profile?.fullName ?? '',
  gender: profile?.gender ?? '',
  age: calcAge(profile?.dateOfBirth ?? ''),
  relationship: profile?.relationship?.toLowerCase() === 'self' ? 'Myself' : 'Other',
  relationshipLabel:
    profile?.relationship?.toLowerCase() === 'self' ? '' : toTitleCase(profile?.relationship ?? ''),
  patientCode: profile?.patientCode ?? '',
  bloodType: profile?.bloodType ?? '',
  photoUrl: profile?.photoUrl ?? '',
});

/**
 * The create/update payload both endpoints take. Empty strings go out as
 * `null`, since the columns are nullable and the API rejects '' on the
 * pattern-checked fields (gender).
 */
const toProfilePayload = (input?: Partial<NewFamilyMember>) => ({
  fullName: input?.fullName?.trim() || null,
  photoUrl: input?.photoUrl || null,
  dateOfBirth: input?.dateOfBirth || null,
  gender: input?.gender?.toLowerCase() || null,
  bloodType: input?.bloodType || null,
  phone: input?.phone?.trim() || null,
  email: input?.email?.trim() || null,
  address: input?.address?.trim() || null,
  emergencyContact: input?.emergencyContact?.trim() || null,
  emergencyPhone: input?.emergencyPhone?.trim() || null,
});

export const PatientRepository = {
  getProfile: async (): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'GET',
      baseUrl: API_URL,
    });

    return toPatientProfile(response);
  },

  /**
   * Creates the account holder's own profile. A freshly registered patient has
   * no profile row, so `getProfile` 404s until this runs once.
   */
  createProfile: async (input: Partial<NewFamilyMember>): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'POST',
      baseUrl: API_URL,
      data: { ...toProfilePayload(input), relationship: 'self' },
    });

    return toPatientProfile(response);
  },

  updateProfile: async (input: Partial<NewFamilyMember>): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'PUT',
      baseUrl: API_URL,
      data: toProfilePayload(input),
    });

    return toPatientProfile(response);
  },

  /**
   * Uploads the picked image and saves the returned blob name on the profile —
   * the account holder's own when `patientCode` is omitted, a relative's when
   * it is given. Returns the updated profile so the screen can re-render.
   */
  updatePhoto: async (file: UploadFile, patientCode?: string): Promise<PatientProfile> => {
    const blobName = await FileRepository.upload(file);

    const response = await apiRequest<any>({
      url: patientCode
        ? `${ENDPOINTS.patientProfile}/${encodeURIComponent(patientCode)}`
        : ENDPOINTS.patientProfile,
      method: 'PUT',
      baseUrl: API_URL,
      data: { photoUrl: blobName },
    });

    return toPatientProfile(response);
  },

  /** One profile by code — the account holder's own or any relative's. */
  getProfileByCode: async (patientCode: string): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: `${ENDPOINTS.patientProfile}/${encodeURIComponent(patientCode ?? '')}`,
      method: 'GET',
      baseUrl: API_URL,
    });

    return toPatientProfile(response);
  },

  /**
   * Every profile on the account — the account holder plus the relatives they
   * can book for. Drives the "Appointment For" selector.
   */
  getAllProfiles: async (): Promise<PatientProfile[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileAll,
      method: 'GET',
      baseUrl: API_URL,
    });

    return Array.isArray(response) ? response?.map(toPatientProfile) ?? [] : [];
  },

  getConditions: async (patientCode?: string): Promise<MedicalCondition[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileMedicalHistory,
      method: 'GET',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
    });

    return Array.isArray(response) ? response?.map(toMedicalCondition) ?? [] : [];
  },

  addCondition: async (
    input: { name: string; diagnosedDate: string; status: ConditionStatus; notes: string },
    patientCode?: string,
  ): Promise<MedicalCondition> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileMedicalHistory,
      method: 'POST',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
      data: {
        condition: input?.name,
        diagnosedDate: input?.diagnosedDate || null,
        status: input?.status?.toLowerCase() || null,
        notes: input?.notes || null,
      },
    });

    return toMedicalCondition(response);
  },

  removeCondition: async (id: string, patientCode?: string): Promise<void> => {
    await apiRequest<void>({
      url: `${ENDPOINTS.patientProfileMedicalHistory}/${encodeURIComponent(id)}`,
      method: 'DELETE',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
    });
  },

  getAllergies: async (patientCode?: string): Promise<Allergy[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileAllergies,
      method: 'GET',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
    });

    return Array.isArray(response) ? response?.map(toAllergy) ?? [] : [];
  },

  addAllergy: async (
    input: { name: string; severity: AllergySeverity; reaction: string },
    patientCode?: string,
  ): Promise<Allergy> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileAllergies,
      method: 'POST',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
      data: {
        allergen: input?.name,
        reaction: input?.reaction || null,
        severity: input?.severity?.toLowerCase() || null,
      },
    });

    return toAllergy(response);
  },

  removeAllergy: async (id: string, patientCode?: string): Promise<void> => {
    await apiRequest<void>({
      url: `${ENDPOINTS.patientProfileAllergies}/${encodeURIComponent(id)}`,
      method: 'DELETE',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : undefined,
    });
  },

  getFamilyMembers: async (): Promise<FamilyMember[]> => {
    const profiles = await PatientRepository.getAllProfiles();
    return profiles?.map(profileToFamilyMember) ?? [];
  },

  addFamilyMember: async (input: NewFamilyMember): Promise<FamilyMember> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        ...toProfilePayload(input),
        relationship: input?.relationship?.toLowerCase(),
      },
    });

    return profileToFamilyMember(toPatientProfile(response));
  },

  updateFamilyMember: async (
    patientCode: string,
    input: Partial<NewFamilyMember>,
  ): Promise<FamilyMember> => {
    const response = await apiRequest<any>({
      url: `${ENDPOINTS.patientProfile}/${encodeURIComponent(patientCode ?? '')}`,
      method: 'PUT',
      baseUrl: API_URL,
      data: {
        ...toProfilePayload(input),
        relationship: input?.relationship?.toLowerCase(),
      },
    });

    return profileToFamilyMember(toPatientProfile(response));
  },

  removeFamilyMember: async (patientCode: string): Promise<void> => {
    await apiRequest<void>({
      url: `${ENDPOINTS.patientProfile}/${encodeURIComponent(patientCode ?? '')}`,
      method: 'DELETE',
      baseUrl: API_URL,
    });
  },
};

export default PatientRepository;
