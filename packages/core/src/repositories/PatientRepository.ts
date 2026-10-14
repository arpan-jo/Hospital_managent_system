/**
 * The patient's own profile, as the portal's My Profile page has it: read from
 * `/hms/patient/profile`, saved through the patient registration it is built
 * on (`/hms/registration/patients`), with the medical history and allergy
 * lists beside it — and the family profiles on the account, which the portal
 * reads and writes through `/hms/patient/profile` itself.
 */
import { API_URL } from '@env';
import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import FileRepository, { UploadFile } from './FileRepository';

/** One profile as `GET /hms/patient/profile` returns it. */
export interface PatientProfile {
  patientProfileId: number;
  userId: number;
  /** The registration the profile is; 0 when the patient has none yet. */
  registrationId: number;
  patientCode: string;
  relationship: string;
  fullName: string;
  /** 'YYYY-MM-DD'. */
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  /** A stored file's id — run it through `getFileUrl` before rendering. */
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
  identificationType: string;
  identificationNumber: string;
  registrationType: string;
  division: string;
  district: string;
  upazila: string;
  coName: string;
  coRelationship: string;
  coMobileNumber: string;
  emergencyRelationship: string;
  emergencyAddress: string;
  occupation: string;
  religion: string;
  nationality: string;
  identityMark: string;
}

/** What the profile form edits — the fields the portal's form has. */
export interface PatientProfileForm {
  identificationType: string;
  identificationNumber: string;
  fullName: string;
  /** 'YYYY-MM-DD'. */
  dateOfBirth: string;
  phone: string;
  bloodType: string;
  gender: string;
  division: string;
  district: string;
  upazila: string;
  address: string;
  coName: string;
  coRelationship: string;
  coMobileNumber: string;
  emergencyContact: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyAddress: string;
  occupation: string;
  nationality: string;
  identityMark: string;
  religion: string;
  email: string;
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

/** A profile on the account, as the prescriptions filter lists them. */
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

// The portal's own option lists — the API takes each value as free text.
export const GENERAL_ID = 'General ID';
export const IDENTIFICATION_TYPES = ['National ID', 'BRN', 'Passport', GENERAL_ID];
export const GENDER_OPTIONS = ['Male', 'Female', 'Others'];
export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const RELATIONSHIP_OPTIONS = [
  'Father',
  'Mother',
  'Spouse',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Other',
];
export const DIVISION_OPTIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
];
export const RELIGION_OPTIONS = ['Islam', 'Hinduism', 'Buddhism', 'Christianity', 'Other'];

/**
 * How a family profile is related to the account holder, as the API stores it
 * (lower case). `self` is the holder's own profile and is never picked.
 */
export const FAMILY_RELATIONSHIPS = ['spouse', 'child', 'parent', 'sibling', 'other'] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number] | 'self';

/** The family form's genders, as the portal sends them (lower case). */
export const FAMILY_GENDERS = ['male', 'female', 'other'];

/** What the portal's family form edits on one profile. */
export interface FamilyProfileForm {
  fullName: string;
  relationship: FamilyRelationship;
  gender: string;
  /** 'YYYY-MM-DD'. */
  dateOfBirth: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export const CONDITION_STATUSES: ConditionStatus[] = ['Active', 'Resolved'];
export const ALLERGY_SEVERITIES: AllergySeverity[] = ['Mild', 'Moderate', 'Severe'];

const toText = (value: any): string => String(value ?? '').trim();

/** 'spouse' -> 'Spouse'. */
const toTitleCase = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';

/** Stored either way ('Male' / 'male', 'Other' / 'Others') — the form offers the portal's spelling. */
const toGender = (raw: any): string => {
  const gender = toTitleCase(toText(raw));
  return gender === 'Other' ? 'Others' : gender;
};

/** Every string field can come back `null` — the model below is non-nullable. */
const toPatientProfile = (raw: any): PatientProfile => ({
  patientProfileId: Number(raw?.patientProfileId ?? 0) || 0,
  userId: Number(raw?.userId ?? 0) || 0,
  registrationId: Number(raw?.registrationId ?? 0) || 0,
  patientCode: toText(raw?.patientCode),
  // "self" marks the account holder's own profile.
  relationship: toText(raw?.relationship)?.toLowerCase() ?? '',
  fullName: toText(raw?.fullName),
  dateOfBirth: toText(raw?.dateOfBirth),
  gender: toGender(raw?.gender),
  bloodType: toText(raw?.bloodType)?.toUpperCase() ?? '',
  phone: toText(raw?.phone),
  email: toText(raw?.email),
  address: toText(raw?.address),
  emergencyContact: toText(raw?.emergencyContact),
  emergencyPhone: toText(raw?.emergencyPhone),
  photoUrl: toText(raw?.photoUrl),
  createdAt: toText(raw?.createdAt),
  updatedAt: toText(raw?.updatedAt),
  identificationType: toText(raw?.identificationType),
  identificationNumber: toText(raw?.identificationNumber),
  registrationType: toText(raw?.registrationType),
  division: toText(raw?.division),
  district: toText(raw?.district),
  upazila: toText(raw?.upazila),
  coName: toText(raw?.coName),
  coRelationship: toText(raw?.coRelationship),
  coMobileNumber: toText(raw?.coMobileNumber),
  emergencyRelationship: toText(raw?.emergencyRelationship),
  emergencyAddress: toText(raw?.emergencyAddress),
  occupation: toText(raw?.occupation),
  religion: toText(raw?.religion),
  nationality: toText(raw?.nationality),
  identityMark: toText(raw?.identityMark),
});

/** The form, filled from a profile — blank where the profile has nothing. */
export const toPatientProfileForm = (
  profile?: PatientProfile | null,
): PatientProfileForm => ({
  identificationType: profile?.identificationType || GENERAL_ID,
  identificationNumber: profile?.identificationNumber ?? '',
  fullName: profile?.fullName ?? '',
  dateOfBirth: profile?.dateOfBirth ?? '',
  phone: profile?.phone ?? '',
  bloodType: profile?.bloodType ?? '',
  gender: profile?.gender ?? '',
  division: profile?.division ?? '',
  district: profile?.district ?? '',
  upazila: profile?.upazila ?? '',
  address: profile?.address ?? '',
  coName: profile?.coName ?? '',
  coRelationship: profile?.coRelationship ?? '',
  coMobileNumber: profile?.coMobileNumber ?? '',
  emergencyContact: profile?.emergencyContact ?? '',
  emergencyRelationship: profile?.emergencyRelationship ?? '',
  emergencyPhone: profile?.emergencyPhone ?? '',
  emergencyAddress: profile?.emergencyAddress ?? '',
  occupation: profile?.occupation ?? '',
  nationality: profile?.nationality ?? '',
  identityMark: profile?.identityMark ?? '',
  religion: profile?.religion ?? '',
  email: profile?.email ?? '',
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

/** A blank field goes out as `null`, as the portal sends it. */
const orNull = (value?: string | null): string | null => value?.trim() || null;

/** A blank field is left out of a family profile, as the portal leaves it out. */
const orOmit = (value?: string | null): string | undefined => value?.trim() || undefined;

/** The family form as the profile endpoints take it. */
const toFamilyPayload = (form: Partial<FamilyProfileForm>, photoUrl?: string) => ({
  fullName: orOmit(form?.fullName),
  relationship: form?.relationship || undefined,
  gender: orOmit(form?.gender)?.toLowerCase(),
  dateOfBirth: orOmit(form?.dateOfBirth),
  bloodType: orOmit(form?.bloodType),
  phone: orOmit(form?.phone),
  email: orOmit(form?.email),
  address: orOmit(form?.address),
  emergencyContact: orOmit(form?.emergencyContact),
  emergencyPhone: orOmit(form?.emergencyPhone),
  ...(photoUrl ? { photoUrl } : {}),
});

/** A profile's own path — `/hms/patient/profile/{patientCode}`. */
const profilePath = (patientCode: string) =>
  `${ENDPOINTS.patientProfile}/${encodeURIComponent(patientCode ?? '')}`;

/** Narrows a records call to one profile on the account; the holder's own when omitted. */
const byCode = (patientCode?: string) => (patientCode ? { patientCode } : undefined);

/**
 * The form in the registration's own field names — the profile calls them
 * differently (`fullName` is `patientName`, `phone` is `mobileNumber`, …).
 */
const toRegistrationFields = (form: PatientProfileForm) => {
  const identificationType = form?.identificationType || GENERAL_ID;

  return {
    identificationType,
    // A General ID has no number to it.
    identificationNumber:
      identificationType === GENERAL_ID ? null : orNull(form?.identificationNumber),
    patientName: form?.fullName?.trim() ?? '',
    dateOfBirth: orNull(form?.dateOfBirth),
    mobileNumber: form?.phone?.trim() ?? '',
    bloodGroup: orNull(form?.bloodType),
    gender: orNull(form?.gender),
    division: orNull(form?.division),
    district: orNull(form?.district),
    upazila: orNull(form?.upazila),
    address: orNull(form?.address),
    coName: orNull(form?.coName),
    coRelationship: orNull(form?.coRelationship),
    coMobileNumber: orNull(form?.coMobileNumber),
    emergencyName: orNull(form?.emergencyContact),
    emergencyRelationship: orNull(form?.emergencyRelationship),
    emergencyMobile: orNull(form?.emergencyPhone),
    emergencyAddress: orNull(form?.emergencyAddress),
    occupation: orNull(form?.occupation),
    nationality: orNull(form?.nationality),
    identityMark: orNull(form?.identityMark),
    religion: orNull(form?.religion),
    email: orNull(form?.email),
  };
};

/**
 * Every field the registration update takes. The update replaces the whole
 * record, so each is carried over from the stored one — the profile shows
 * only some of them (father's name, marital status, … are kept by staff).
 */
const REGISTRATION_FIELDS = [
  'identificationType',
  'identificationNumber',
  'title',
  'patientName',
  'dateOfBirth',
  'gender',
  'mobileNumber',
  'bloodGroup',
  'registrationType',
  'photoUrl',
  'userId',
  'accountId',
  'branchId',
  'officeId',
  'division',
  'district',
  'upazila',
  'address',
  'coName',
  'coRelationship',
  'coMobileNumber',
  'emergencyName',
  'emergencyRelationship',
  'emergencyMobile',
  'emergencyAddress',
  'occupation',
  'religion',
  'nationality',
  'email',
  'identityMark',
  'fatherName',
  'maritalStatus',
  'spouseName',
  'presentAddress',
  'permanentAddress',
  'emergencyOccupation',
] as const;

/**
 * Applies `changes` to the patient's registration: the stored record is read
 * first and sent back whole with the changes on top, so nothing the profile
 * does not show is wiped.
 */
const updateRegistration = async (
  registrationId: number,
  changes: Record<string, any>,
): Promise<void> => {
  const url = `${ENDPOINTS.patientRegistration}/${registrationId}`;
  const stored = await apiRequest<any>({ url, method: 'GET', baseUrl: API_URL });

  const kept = Object.fromEntries(
    REGISTRATION_FIELDS.map(field => [field, stored?.[field] ?? null]),
  );

  await apiRequest<any>({
    url,
    method: 'PUT',
    baseUrl: API_URL,
    data: { ...kept, ...changes },
  });
};

/**
 * Whether a profile carries what a booking needs — the portal's own rule:
 * name, date of birth, phone, blood type and gender all filled in.
 */
export const isPatientProfileComplete = (
  profile?: PatientProfile | null,
): boolean =>
  Boolean(
    profile?.fullName?.trim() &&
      profile?.dateOfBirth &&
      profile?.phone?.trim() &&
      profile?.bloodType &&
      profile?.gender,
  );

export const PatientRepository = {
  /** `GET /hms/patient/profile` — a 404 means the patient has no profile yet. */
  getProfile: async (): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'GET',
      baseUrl: API_URL,
    });

    return toPatientProfile(response);
  },

  /**
   * Saves the form, then reads the profile back. With a registration it is
   * updated (`PUT /hms/registration/patients/{id}`); without one it is created
   * (`POST /hms/registration/patients`), and the server ties it to this login.
   * `photoUrl` is the stored file id of a photo picked before the first save.
   */
  saveProfile: async (
    form: PatientProfileForm,
    registrationId?: number,
    photoUrl?: string,
  ): Promise<PatientProfile> => {
    const fields = toRegistrationFields(form);
    const id = Number(registrationId ?? 0) || 0;

    if (id > 0) {
      await updateRegistration(id, photoUrl ? { ...fields, photoUrl } : fields);
    } else {
      await apiRequest<any>({
        url: ENDPOINTS.patientRegistration,
        method: 'POST',
        baseUrl: API_URL,
        // The server takes the owner from the login; the ids are staff fields.
        data: {
          ...fields,
          photoUrl: photoUrl || null,
          userId: 0,
          accountId: 0,
          branchId: 0,
          officeId: 0,
        },
      });
    }

    return PatientRepository.getProfile();
  },

  /** Uploads the picked image and stores it as the profile photo; returns the profile as saved. */
  updatePhoto: async (file: UploadFile, registrationId: number): Promise<PatientProfile> => {
    const photoUrl = await FileRepository.upload(file);
    await updateRegistration(registrationId, { photoUrl });

    return PatientRepository.getProfile();
  },

  /** Uploads an image picked before the profile exists; returns its stored file id. */
  uploadPhoto: (file: UploadFile): Promise<string> => FileRepository.upload(file),

  /** Every profile on the account. */
  getAllProfiles: async (): Promise<PatientProfile[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileAll,
      method: 'GET',
      baseUrl: API_URL,
    });

    return Array.isArray(response) ? response?.map(toPatientProfile) ?? [] : [];
  },

  getFamilyMembers: async (): Promise<FamilyMember[]> => {
    const profiles = await PatientRepository.getAllProfiles();
    return profiles?.map(profileToFamilyMember) ?? [];
  },

  /** `POST /hms/patient/profile` — a family member's profile, as the portal adds one. */
  createFamilyProfile: async (
    form: FamilyProfileForm,
    photoUrl?: string,
  ): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfile,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        ...toFamilyPayload(form, photoUrl),
        fullName: form?.fullName?.trim() ?? '',
        relationship: form?.relationship,
      },
    });

    return toPatientProfile(response);
  },

  /** `PUT /hms/patient/profile/{patientCode}` — one family profile. */
  updateFamilyProfile: async (
    patientCode: string,
    form: Partial<FamilyProfileForm>,
    photoUrl?: string,
  ): Promise<PatientProfile> => {
    const response = await apiRequest<any>({
      url: profilePath(patientCode),
      method: 'PUT',
      baseUrl: API_URL,
      data: toFamilyPayload(form, photoUrl),
    });

    return toPatientProfile(response);
  },

  /** `DELETE /hms/patient/profile/{patientCode}`. */
  removeFamilyProfile: async (patientCode: string): Promise<void> => {
    await apiRequest<void>({ url: profilePath(patientCode), method: 'DELETE', baseUrl: API_URL });
  },

  /** A family member's photo: uploaded, then stored on their profile. */
  updateFamilyPhoto: async (file: UploadFile, patientCode: string): Promise<void> => {
    const photoUrl = await FileRepository.upload(file);
    await apiRequest<any>({
      url: profilePath(patientCode),
      method: 'PUT',
      baseUrl: API_URL,
      data: { photoUrl },
    });
  },

  getConditions: async (patientCode?: string): Promise<MedicalCondition[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileMedicalHistory,
      method: 'GET',
      baseUrl: API_URL,
      params: byCode(patientCode),
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
      params: byCode(patientCode),
      data: {
        condition: input?.name?.trim() ?? '',
        diagnosedDate: input?.diagnosedDate || null,
        status: input?.status?.toLowerCase() || 'active',
        notes: orNull(input?.notes),
      },
    });

    return toMedicalCondition(response);
  },

  removeCondition: async (id: string, patientCode?: string): Promise<void> => {
    await apiRequest<void>({
      url: `${ENDPOINTS.patientProfileMedicalHistory}/${encodeURIComponent(id ?? '')}`,
      method: 'DELETE',
      baseUrl: API_URL,
      params: byCode(patientCode),
    });
  },

  getAllergies: async (patientCode?: string): Promise<Allergy[]> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.patientProfileAllergies,
      method: 'GET',
      baseUrl: API_URL,
      params: byCode(patientCode),
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
      params: byCode(patientCode),
      data: {
        allergen: input?.name?.trim() ?? '',
        reaction: orNull(input?.reaction),
        severity: input?.severity?.toLowerCase() || 'mild',
      },
    });

    return toAllergy(response);
  },

  removeAllergy: async (id: string, patientCode?: string): Promise<void> => {
    await apiRequest<void>({
      url: `${ENDPOINTS.patientProfileAllergies}/${encodeURIComponent(id ?? '')}`,
      method: 'DELETE',
      baseUrl: API_URL,
      params: byCode(patientCode),
    });
  },
};

export default PatientRepository;
