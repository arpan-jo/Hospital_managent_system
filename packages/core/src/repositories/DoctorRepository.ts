import { offlineCache } from '../utils/offlineCache';

export interface ScheduleSlot {
  /** 0 = Sunday, matching the `days` array in the locale files. */
  day: number;
  start: string;
  end: string;
}

export type DoctorGender = 'Male' | 'Female';

export interface DoctorEducation {
  degree: string;
  institution: string;
}

export interface DoctorReview {
  id: string;
  name: string;
  /** Pre-formatted display date, e.g. "Aug 5, 2026". */
  date: string;
  rating: number;
  comment: string;
}

export interface Doctor {
  id: string;
  name: string;
  photo?: string | null;
  designation: string;
  specialty: string;
  /** Degree string shown under the name, e.g. "MBBS, FCPS (Cardiology)". */
  qualification: string;
  hospital: string;
  department: string;
  /** Named site shown on the Availability tab, e.g. "Mirpur Site". */
  practiceLocation: string;
  /** Number of hospitals/chambers the doctor sits at. */
  siteCount: number;
  gender: DoctorGender;
  /** 0-5, one decimal. */
  rating: number;
  /** Completed consultations, shown next to the rating. */
  consultations: number;
  bio: string;
  specializations: string[];
  education: DoctorEducation[];
  experienceHistory: string[];
  awards: string[];
  reviews: DoctorReview[];
  serial: number;
  mobile: string;
  fee: number;
  experienceYears: number;
  followUpFee: number;
  reportVisitFee: number;
  followUpValidityDays: number;
  schedule: ScheduleSlot[];
}

/** Fixed browse-by-specialty taxonomy — drives the Home specialty grid and the Find Doctors chips. */
export const DOCTOR_SPECIALTIES = [
  'Cardiologist',
  'Neurologist',
  'Orthopedic',
  'Dermatologist',
  'Gynecologist',
  'Ophthalmologist',
] as const;

const WEEKDAY_SCHEDULE: ScheduleSlot[] = [0, 1, 2, 3, 4].map(day => ({
  day,
  start: '14:00',
  end: '18:00',
}));

const WEEKEND_SCHEDULE: ScheduleSlot[] = [
  { day: 5, start: '10:00', end: '14:00' },
  { day: 6, start: '10:00', end: '14:00' },
];

const CACHE_KEY = 'appointment_doctors';

// ponytail: static list until the Health API exists. Swap the body of
// `fetchDoctors` for `apiRequest<Doctor[]>({ url: ENDPOINTS.DOCTORS, method: 'GET' })`
// plus a mapper — the cache/refresh wiring below stays as-is.
const MOCK_DOCTORS: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Sadia Rahman',
    photo: 'https://randomuser.me/api/portraits/women/44.jpg',
    designation: 'Consultant',
    specialty: 'Cardiologist',
    qualification: 'MBBS, FCPS (Cardiology)',
    hospital: 'Dhaka Medical College Hospital',
    department: 'Cardiology Department',
    practiceLocation: 'Dhaka Medical Site',
    siteCount: 1,
    gender: 'Female',
    rating: 4.8,
    consultations: 1240,
    bio: 'Dr. Sadia Rahman is a Consultant Cardiologist with 6 years of experience in interventional cardiology and heart failure management.',
    specializations: ['Cardiology', 'Interventional Cardiology', 'Heart Failure'],
    education: [
      { degree: 'MBBS', institution: 'Dhaka Medical College' },
      { degree: 'FCPS (Cardiology)', institution: 'Bangladesh College of Physicians and Surgeons' },
    ],
    experienceHistory: [
      'Dhaka Medical College Hospital — 6 years, Consultant Cardiologist',
      'Square Hospital — 2 years, Resident Cardiologist',
    ],
    awards: ['Best Young Cardiologist Award 2023'],
    reviews: [
      {
        id: 'r1',
        name: 'Rahim Uddin',
        date: 'Aug 5, 2026',
        rating: 5,
        comment:
          'Excellent doctor! Very thorough examination and explained everything clearly. Highly recommended for anyone with cardiac concerns.',
      },
      {
        id: 'r2',
        name: 'Sabrina Akter',
        date: 'Jul 28, 2026',
        rating: 4,
        comment:
          'Very professional and caring. Wait time was a bit long but the consultation was worth it. Will visit again.',
      },
      {
        id: 'r3',
        name: 'Kamal Hossain',
        date: 'Jul 15, 2026',
        rating: 5,
        comment: 'Best surgeon in Dhaka. My surgery went perfectly and recovery was smooth. Forever grateful.',
      },
      {
        id: 'r4',
        name: 'Nasreen Begum',
        date: 'Jun 30, 2026',
        rating: 4,
        comment: 'Good experience overall. The doctor listened carefully and prescribed the right medication.',
      },
    ],
    serial: 1,
    mobile: '01766666666',
    fee: 1500,
    experienceYears: 6,
    followUpFee: 700,
    reportVisitFee: 400,
    followUpValidityDays: 21,
    schedule: [
      { day: 6, start: '09:00', end: '13:00' },
      { day: 1, start: '17:00', end: '21:00' },
      { day: 3, start: '17:00', end: '21:00' },
    ],
  },
  {
    id: '2',
    name: 'Dr. Kamal Hossain',
    photo: 'https://randomuser.me/api/portraits/men/32.jpg',
    designation: 'Doctor',
    specialty: 'Cardiologist',
    qualification: 'MBBS, MD (Cardiology)',
    hospital: 'Square Hospital',
    department: 'Cardiology Department',
    practiceLocation: 'Panthapath Site',
    siteCount: 1,
    gender: 'Male',
    rating: 4.0,
    consultations: 860,
    bio: 'Dr. Kamal Hossain is a Cardiologist at Square Hospital, focused on preventive cardiology and routine heart checkups.',
    specializations: ['Cardiology', 'Preventive Cardiology'],
    education: [
      { degree: 'MBBS', institution: 'Chittagong Medical College' },
      { degree: 'MD (Cardiology)', institution: 'Bangabandhu Sheikh Mujib Medical University' },
    ],
    experienceHistory: ['Square Hospital — 8 years, Cardiologist'],
    awards: [],
    reviews: [
      {
        id: 'r1',
        name: 'Farida Yasmin',
        date: 'Jul 20, 2026',
        rating: 4,
        comment: 'Knowledgeable and patient. Took time to answer all my questions.',
      },
    ],
    serial: 2,
    mobile: '01755555555',
    fee: 1200,
    experienceYears: 8,
    followUpFee: 600,
    reportVisitFee: 350,
    followUpValidityDays: 30,
    schedule: WEEKDAY_SCHEDULE,
  },
  {
    id: '3',
    name: 'MD. Rafiul Islam',
    photo: 'https://randomuser.me/api/portraits/men/54.jpg',
    designation: 'Consultant',
    specialty: 'Neurologist',
    qualification: 'MBBS, FCPS (Neurology)',
    hospital: 'United Hospital',
    department: 'Neurology Department',
    practiceLocation: 'Gulshan Site',
    siteCount: 2,
    gender: 'Male',
    rating: 4.5,
    consultations: 1520,
    bio: 'MD. Rafiul Islam is a Consultant Neurologist with 10 years of experience treating stroke, epilepsy and headache disorders.',
    specializations: ['Neurology', 'Stroke Medicine', 'Epilepsy'],
    education: [
      { degree: 'MBBS', institution: 'Sir Salimullah Medical College' },
      { degree: 'FCPS (Neurology)', institution: 'Bangladesh College of Physicians and Surgeons' },
    ],
    experienceHistory: [
      'United Hospital — 7 years, Consultant Neurologist',
      'National Institute of Neurosciences — 3 years, Medical Officer',
    ],
    awards: ['Fellowship in Stroke Medicine, Singapore'],
    reviews: [
      {
        id: 'r1',
        name: 'Jasim Uddin',
        date: 'Aug 1, 2026',
        rating: 5,
        comment: 'Diagnosed a problem two other doctors missed. Extremely thorough and kind.',
      },
      {
        id: 'r2',
        name: 'Shirin Aktar',
        date: 'Jul 10, 2026',
        rating: 4,
        comment: 'Very knowledgeable. Explains things in a way that is easy to understand.',
      },
    ],
    serial: 3,
    mobile: '01711111111',
    fee: 1800,
    experienceYears: 10,
    followUpFee: 900,
    reportVisitFee: 500,
    followUpValidityDays: 21,
    schedule: WEEKDAY_SCHEDULE,
  },
  {
    id: '4',
    name: 'Dr. Ashraf Hossain',
    photo: 'https://randomuser.me/api/portraits/men/68.jpg',
    designation: 'Doctor',
    specialty: 'Orthopedic',
    qualification: 'MBBS, D-Ortho',
    hospital: 'Popular Diagnostic Center',
    department: 'Orthopedic Department',
    practiceLocation: 'Dhanmondi Site',
    siteCount: 1,
    gender: 'Male',
    rating: 5.0,
    consultations: 690,
    bio: 'Dr. Ashraf Hossain treats fractures, joint pain and sports injuries with a focus on non-surgical recovery where possible.',
    specializations: ['Orthopedics', 'Sports Injury', 'Joint Pain'],
    education: [{ degree: 'MBBS', institution: 'Rajshahi Medical College' }, { degree: 'D-Ortho', institution: 'NITOR, Dhaka' }],
    experienceHistory: ['Popular Diagnostic Center — 5 years, Orthopedic Doctor'],
    awards: [],
    reviews: [
      {
        id: 'r1',
        name: 'Mizanur Rahman',
        date: 'Aug 3, 2026',
        rating: 5,
        comment: 'Fixed my knee pain in two sessions. Highly recommend for sports injuries.',
      },
    ],
    serial: 4,
    mobile: '01777777777',
    fee: 800,
    experienceYears: 5,
    followUpFee: 400,
    reportVisitFee: 250,
    followUpValidityDays: 30,
    schedule: WEEKDAY_SCHEDULE,
  },
  {
    id: '5',
    name: 'Dr. Nusrat Jahan',
    photo: 'https://randomuser.me/api/portraits/women/68.jpg',
    designation: 'Consultant',
    specialty: 'Dermatologist',
    qualification: 'MBBS, DDV',
    hospital: 'Apollo Hospital',
    department: 'Dermatology Department',
    practiceLocation: 'Bashundhara Site',
    siteCount: 1,
    gender: 'Female',
    rating: 4.2,
    consultations: 540,
    bio: 'Dr. Nusrat Jahan specializes in acne, eczema and skin allergy treatment for both adults and children.',
    specializations: ['Dermatology', 'Cosmetic Dermatology'],
    education: [{ degree: 'MBBS', institution: 'Mymensingh Medical College' }, { degree: 'DDV', institution: 'Bangabandhu Sheikh Mujib Medical University' }],
    experienceHistory: ['Apollo Hospital — 4 years, Consultant Dermatologist'],
    awards: [],
    reviews: [],
    serial: 5,
    mobile: '01722222222',
    fee: 1000,
    experienceYears: 4,
    followUpFee: 500,
    reportVisitFee: 300,
    followUpValidityDays: 21,
    schedule: WEEKEND_SCHEDULE,
  },
  {
    id: '6',
    name: 'Dr. Farhana Akter',
    photo: 'https://randomuser.me/api/portraits/women/32.jpg',
    designation: 'Consultant',
    specialty: 'Gynecologist',
    qualification: 'MBBS, FCPS (Gynae & Obs)',
    hospital: 'Ibn Sina Hospital',
    department: 'Gynecology & Obstetrics Department',
    practiceLocation: 'Kallyanpur Site',
    siteCount: 2,
    gender: 'Female',
    rating: 4.6,
    consultations: 980,
    bio: 'Dr. Farhana Akter is a Consultant Gynecologist & Obstetrician with 9 years of experience in prenatal care and women’s health.',
    specializations: ['Gynecology', 'Obstetrics', 'High-Risk Pregnancy'],
    education: [
      { degree: 'MBBS', institution: 'Sylhet MAG Osmani Medical College' },
      { degree: 'FCPS (Gynae & Obs)', institution: 'Bangladesh College of Physicians and Surgeons' },
    ],
    experienceHistory: ['Ibn Sina Hospital — 9 years, Consultant Gynecologist'],
    awards: ['Certificate of Excellence in Maternal Care, 2022'],
    reviews: [
      {
        id: 'r1',
        name: 'Taslima Begum',
        date: 'Jul 22, 2026',
        rating: 5,
        comment: 'Guided me through a difficult pregnancy with so much care. Forever thankful.',
      },
    ],
    serial: 6,
    mobile: '01733333333',
    fee: 1200,
    experienceYears: 9,
    followUpFee: 600,
    reportVisitFee: 350,
    followUpValidityDays: 30,
    schedule: WEEKDAY_SCHEDULE,
  },
  {
    id: '7',
    name: 'Dr. Tanvir Hasan',
    photo: 'https://randomuser.me/api/portraits/men/76.jpg',
    designation: 'Doctor',
    specialty: 'Ophthalmologist',
    qualification: 'MBBS, DO',
    hospital: 'LabAid Hospital',
    department: 'Ophthalmology Department',
    practiceLocation: 'Dhanmondi Site',
    siteCount: 1,
    gender: 'Male',
    rating: 4.0,
    consultations: 410,
    bio: 'Dr. Tanvir Hasan treats common eye conditions including refractive errors, cataract and conjunctivitis.',
    specializations: ['Ophthalmology', 'Cataract Care'],
    education: [{ degree: 'MBBS', institution: 'Comilla Medical College' }, { degree: 'DO', institution: 'Bangladesh Eye Hospital' }],
    experienceHistory: ['LabAid Hospital — 3 years, Ophthalmologist'],
    awards: [],
    reviews: [
      {
        id: 'r1',
        name: 'Habibur Rahman',
        date: 'Jun 18, 2026',
        rating: 4,
        comment: 'Quick and clear diagnosis. Prescribed glasses that fixed my headaches.',
      },
    ],
    serial: 7,
    mobile: '01744444444',
    fee: 700,
    experienceYears: 3,
    followUpFee: 350,
    reportVisitFee: 200,
    followUpValidityDays: 30,
    schedule: WEEKEND_SCHEDULE,
  },
  {
    id: '8',
    name: 'Dr. Rezaul Karim',
    photo: 'https://randomuser.me/api/portraits/men/45.jpg',
    designation: 'Doctor',
    specialty: 'Cardiologist',
    qualification: 'MBBS, MD',
    hospital: 'Evercare Hospital',
    department: 'Cardiology Department',
    practiceLocation: 'Bashundhara Site',
    siteCount: 1,
    gender: 'Male',
    rating: 3.9,
    consultations: 260,
    bio: 'Dr. Rezaul Karim is a Cardiologist at Evercare Hospital, recently joined after completing his MD in Cardiology.',
    specializations: ['Cardiology'],
    education: [{ degree: 'MBBS', institution: 'Rangpur Medical College' }, { degree: 'MD', institution: 'National Institute of Cardiovascular Diseases' }],
    experienceHistory: ['Evercare Hospital — 2 years, Cardiologist'],
    awards: [],
    reviews: [],
    serial: 8,
    mobile: '01799999999',
    fee: 900,
    experienceYears: 2,
    followUpFee: 450,
    reportVisitFee: 250,
    followUpValidityDays: 30,
    schedule: WEEKDAY_SCHEDULE,
  },
];

/** Defensive mapping — never trust the payload shape once this hits a real API. */
const toDoctor = (raw: any, index: number): Doctor => ({
  id: String(raw?.id ?? index),
  name: raw?.name ?? 'Unknown',
  photo: raw?.photo ?? null,
  designation: raw?.designation ?? 'Doctor',
  specialty: raw?.specialty ?? '',
  qualification: raw?.qualification ?? '',
  hospital: raw?.hospital ?? '',
  department: raw?.department ?? '',
  practiceLocation: raw?.practiceLocation ?? '',
  siteCount: Number(raw?.siteCount ?? 1),
  gender: raw?.gender === 'Female' ? 'Female' : 'Male',
  rating: Number(raw?.rating ?? 0),
  consultations: Number(raw?.consultations ?? 0),
  bio: raw?.bio ?? '',
  specializations: Array.isArray(raw?.specializations) ? raw.specializations : [],
  education: Array.isArray(raw?.education)
    ? raw.education.map((item: any) => ({ degree: item?.degree ?? '', institution: item?.institution ?? '' }))
    : [],
  experienceHistory: Array.isArray(raw?.experienceHistory) ? raw.experienceHistory : [],
  awards: Array.isArray(raw?.awards) ? raw.awards : [],
  reviews: Array.isArray(raw?.reviews)
    ? raw.reviews.map((review: any) => ({
        id: String(review?.id ?? ''),
        name: review?.name ?? 'Unknown',
        date: review?.date ?? '',
        rating: Number(review?.rating ?? 0),
        comment: review?.comment ?? '',
      }))
    : [],
  serial: Number(raw?.serial ?? index + 1),
  mobile: raw?.mobile ?? '',
  fee: Number(raw?.fee ?? 0),
  experienceYears: Number(raw?.experienceYears ?? 0),
  followUpFee: Number(raw?.followUpFee ?? 0),
  reportVisitFee: Number(raw?.reportVisitFee ?? 0),
  followUpValidityDays: Number(raw?.followUpValidityDays ?? 0),
  schedule: Array.isArray(raw?.schedule)
    ? raw.schedule.map((slot: any) => ({
        day: Number(slot?.day ?? 0),
        start: slot?.start ?? '',
        end: slot?.end ?? '',
      }))
    : [],
});

const fetchDoctors = async (): Promise<Doctor[]> =>
  MOCK_DOCTORS.map(toDoctor);

export const DoctorRepository = {
  /** Cached read — serves MMKV first, fetches only when missing or expired. */
  getDoctors: (ttlMinutes = 10): Promise<Doctor[]> =>
    offlineCache.getOrFetch<Doctor[]>(CACHE_KEY, fetchDoctors, ttlMinutes),

  /** Pull-to-refresh — bypasses the cache and rewrites it. */
  refreshDoctors: async (ttlMinutes = 10): Promise<Doctor[]> => {
    const data = await fetchDoctors();
    offlineCache.set(CACHE_KEY, data, ttlMinutes);
    return data;
  },

  /** Single-doctor lookup for the profile screen. */
  getDoctorById: async (id: string): Promise<Doctor | null> => {
    const doctors = await fetchDoctors();
    return doctors.find(doctor => doctor.id === id) ?? null;
  },
};

export default DoctorRepository;
