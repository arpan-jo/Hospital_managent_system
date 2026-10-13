import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppointmentType,
  DoctorDetailsInfo,
  DoctorDetailsRepository,
  DoctorLocation,
  DoctorTimeSlot,
  PatientProfile,
  PatientRepository,
  groupThousands,
  toISODate,
} from '@app/core';
import { RequestState } from './useFindDoctorsViewModel';

/** The appointment `type` values this flow can book — see `AppointmentType`. */
export type ConsultationType = AppointmentType;

/** Bangladesh keeps one clock all year, UTC+6 — and every chamber is there. */
const DHAKA_UTC_OFFSET_MINUTES = 6 * 60;

/**
 * Now, as a Date whose local fields read Dhaka's clock. A phone set to another
 * time zone (a relative booking from abroad) still judges a window by the
 * chamber's own time.
 */
const dhakaNow = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + DHAKA_UTC_OFFSET_MINUTES) * 60_000);
};

/** One selectable consultation row. Fees are per chamber, not per doctor. */
export interface ConsultationOptionRow {
  value: ConsultationType;
  labelKey: string;
  /** Empty when the row has nothing to say under its title. */
  descKey: string;
  descOptions: Record<string, unknown>;
  icon: string;
  amount: number;
}

/**
 * The doctor's own `consultationOptions` are telemedicine: `audio` and `video`
 * are the two types the API publishes, and both are stored on the appointment
 * as-is. Booking them is parked for now — re-enable this map together with the
 * row builder in `consultationOptions` below.
 */
// const TELEMEDICINE_META: Record<string, { labelKey: string; icon: string }> = {
//   audio: { labelKey: 'doctorProfile.audioConsultation', icon: 'phone-outline' },
//   video: { labelKey: 'doctorProfile.videoConsultation', icon: 'video-outline' },
// };

/** How far ahead the weekday strip runs. */
const WEEKDAY_COUNT = 7;

const EMPTY_DOCTOR_REQUEST: RequestState<DoctorDetailsInfo | null> = {
  isLoading: false,
  data: null,
  error: null,
};

/**
 * Everything the Create Appointment screen shows comes from two calls:
 * `GET /api/doctors/{id}` for the doctor, chambers, schedule and fees, and
 * `GET /api/patient/profile/all` for the "Appointment For" list. The screen
 * stays a pure view — fetching, selection and the derived labels live here.
 */
export const useCreateAppointmentViewModel = (
  doctorId: string,
  preselectedSlotStart?: string,
) => {
  const { t } = useTranslation();

  const [doctorDetailsRequest, setDoctorDetailsRequest] = useState<
    RequestState<DoctorDetailsInfo | null>
  >({ ...EMPTY_DOCTOR_REQUEST, isLoading: true });

  const [patientProfilesRequest, setPatientProfilesRequest] = useState<
    RequestState<PatientProfile[]>
  >({ isLoading: true, data: [], error: null });

  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState('');
  const [consultationType, setConsultationType] =
    useState<ConsultationType>('in_person');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const fetchDoctorDetails = useCallback(async () => {
    // A deep link can land on this screen without an id — nothing to fetch.
    if (!doctorId) {
      setDoctorDetailsRequest(EMPTY_DOCTOR_REQUEST);
      return;
    }

    setDoctorDetailsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await DoctorDetailsRepository.getDoctorDetails(doctorId);
      setDoctorDetailsRequest({
        isLoading: false,
        data: response ?? null,
        error: null,
      });
      setSelectedLocationId(response?.locations?.[0]?.locationId ?? '');
    } catch (error: any) {
      console.log('fetchDoctorDetails error ==>', error?.message);
      setDoctorDetailsRequest({
        isLoading: false,
        data: null,
        error: error?.message ?? null,
      });
    }
  }, [doctorId]);

  const fetchPatientProfiles = useCallback(async () => {
    setPatientProfilesRequest(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await PatientRepository.getAllProfiles();
      setPatientProfilesRequest({
        isLoading: false,
        data: response ?? [],
        error: null,
      });

      // The account holder's own profile is the sensible default.
      const self =
        response?.find(profile => profile?.relationship === 'self') ??
        response?.[0];
      setSelectedProfileId(self?.patientProfileId ?? 0);
    } catch (error: any) {
      console.log('fetchPatientProfiles error ==>', error?.message);
      setPatientProfilesRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  useEffect(() => {
    fetchPatientProfiles();
  }, [fetchPatientProfiles]);

  const doctor = doctorDetailsRequest?.data ?? null;
  const patientProfiles = useMemo(
    () => patientProfilesRequest?.data ?? [],
    [patientProfilesRequest?.data],
  );

  const locations = useMemo(() => doctor?.locations ?? [], [doctor]);

  /** Falls back to the first chamber, so fees/schedule always have a source. */
  const selectedLocation = useMemo<DoctorLocation | null>(
    () =>
      locations?.find(location => location?.locationId === selectedLocationId) ??
      locations?.[0] ??
      null,
    [locations, selectedLocationId],
  );

  const selectedProfile = useMemo<PatientProfile | null>(
    () =>
      patientProfiles?.find(
        profile => profile?.patientProfileId === selectedProfileId,
      ) ??
      patientProfiles?.[0] ??
      null,
    [patientProfiles, selectedProfileId],
  );

  const weekdays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: WEEKDAY_COUNT }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() + index);
      return day;
    });
  }, []);

  // The custom date, when the user picked one, otherwise the weekday strip.
  const date = useMemo(
    () => customDate ?? weekdays?.[selectedDayIndex] ?? new Date(),
    [customDate, weekdays, selectedDayIndex],
  );

  /** The chamber's published windows for the weekday the given date falls on. */
  const slotsForDay = useCallback(
    (day: Date): DoctorTimeSlot[] =>
      selectedLocation?.schedule?.find(
        entry => entry?.dayIndex === day?.getDay(),
      )?.timeSlots ?? [],
    [selectedLocation],
  );

  const slots = useMemo(() => slotsForDay(date), [slotsForDay, date]);

  const dateKey = toISODate(date);

  // A slot only exists inside one chamber on one day: switching either would
  // leave a stale window looking chosen, so the selection restarts from the
  // route's preselected slot (usually none).
  useEffect(() => {
    setSelectedSlotStart(preselectedSlotStart ?? '');
  }, [selectedLocationId, dateKey, preselectedSlotStart]);

  /**
   * True for a window that has closed by Dhaka's clock: any window on a day
   * already gone (a screen left open past midnight), or one today whose end
   * time has passed. Neither the portal nor the server checks this, and such a
   * booking would sit in Upcoming and then turn Absent. Read at call time — the
   * view asks again on render and Continue asks once more, so a window that
   * closes while the screen is open is not booked.
   *
   * A window ending at or before its start (`20:00–00:00`) runs past midnight,
   * so it is never over today.
   */
  const isSlotOver = useCallback(
    (slot?: DoctorTimeSlot | null): boolean => {
      const now = dhakaNow();
      const today = toISODate(now);
      if (dateKey !== today) return dateKey < today;

      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}`;
      const startTime = String(slot?.startTime ?? '').slice(0, 5);
      const endTime = String(slot?.endTime ?? '').slice(0, 5);
      if (!endTime || endTime <= startTime) return false;
      return endTime <= nowTime;
    },
    [dateKey],
  );

  // A window that is over cannot stay chosen — the route's preselected one included.
  const selectedSlot = useMemo<DoctorTimeSlot | null>(
    () =>
      slots?.find(slot => slot?.startTime === selectedSlotStart && !isSlotOver(slot)) ??
      null,
    [slots, selectedSlotStart, isSlotOver],
  );

  /**
   * The chamber visits come from the selected location's fees. Audio/video
   * telemedicine is commented out below until that flow is agreed — the API
   * still returns the options, so the Doctor Details screen keeps showing them.
   */
  const consultationOptions = useMemo<ConsultationOptionRow[]>(() => {
    const rows: ConsultationOptionRow[] = [];

    if (selectedLocation) {
      rows?.push({
        value: 'in_person',
        labelKey: 'booking.inPersonVisit',
        descKey: 'createAppointment.inPersonDesc',
        descOptions: {},
        icon: 'stethoscope',
        amount: selectedLocation?.consultationFee ?? 0,
      });

      // A visit the chamber has no fee for is not offered, as on the portal:
      // the server would bill the full consultation fee for it instead.
      const followUpFee = selectedLocation?.followUpFee ?? null;
      if (followUpFee !== null) {
        rows?.push({
          value: 'follow_up',
          labelKey: 'booking.followUpVisit',
          descKey: 'doctorProfile.followUpDesc',
          descOptions: { days: selectedLocation?.followUpValidDays ?? 0 },
          icon: 'calendar-refresh-outline',
          amount: followUpFee,
        });
      }

      const reportFee = selectedLocation?.reportFee ?? null;
      if (reportFee !== null) {
        rows?.push({
          value: 'report',
          labelKey: 'booking.reportVisit',
          descKey: 'doctorProfile.reportVisitDesc',
          descOptions: {},
          icon: 'file-document-outline',
          amount: reportFee,
        });
      }
    }

    // Telemedicine rows — the doctor's enabled audio/video options:
    // doctor?.consultationOptions?.forEach(option => {
    //   const meta = TELEMEDICINE_META[option?.type ?? ''];
    //   if (!meta || !option?.enabled) return;
    //
    //   rows?.push({
    //     value: option?.type as ConsultationType,
    //     labelKey: meta?.labelKey,
    //     descKey: option?.durationMinutes ? 'doctorProfile.durationMinutes' : '',
    //     descOptions: { value: option?.durationMinutes ?? 0 },
    //     icon: meta?.icon,
    //     amount: option?.fee ?? 0,
    //   });
    // });

    return rows;
  }, [selectedLocation]);

  // Switching chamber can drop the selected type (a doctor may publish video at
  // one site only), which would otherwise book a type with no fee behind it.
  useEffect(() => {
    if (!consultationOptions?.length) return;

    const stillOffered = consultationOptions?.some(
      option => option?.value === consultationType,
    );
    if (!stillOffered) {
      setConsultationType(consultationOptions?.[0]?.value ?? 'in_person');
    }
  }, [consultationOptions, consultationType]);

  const amount = useMemo(
    () =>
      consultationOptions?.find(option => option?.value === consultationType)
        ?.amount ?? 0,
    [consultationOptions, consultationType],
  );

  const taka = useCallback(
    (value?: number | null) => `৳${groupThousands(value ?? 0)}`,
    [],
  );

  /** "৳1,200 - ৳1,600", or a single amount when the chambers charge the same. */
  const feeRangeLabel = useMemo(() => {
    const min = doctor?.minFee ?? 0;
    const max = doctor?.maxFee ?? 0;

    if (!min && !max) return t('common.na');
    if (!max || min === max) return taka(min || max);
    return `${taka(min)} - ${taka(max)}`;
  }, [doctor?.minFee, doctor?.maxFee, t, taka]);

  /** "Self" / "Other" for the known values, the API's own word otherwise. */
  const relationshipLabel = useCallback(
    (profile?: PatientProfile | null) => {
      const relationship = profile?.relationship ?? '';
      if (relationship === 'self') return t('bookAppointment.self');
      if (relationship === 'other') return t('bookAppointment.other');
      return relationship || t('common.na');
    },
    [t],
  );

  const handlePickCustomDate = useCallback(
    (picked: Date) => setCustomDate(picked),
    [],
  );

  // Seeds the currently shown day so the field renders, which is what opens the
  // picker — see `autoOpen` in the view.
  const handleStartCustomDate = useCallback(
    () => setCustomDate(weekdays[selectedDayIndex] ?? new Date()),
    [weekdays, selectedDayIndex],
  );

  const handleUseWeekdays = useCallback(() => setCustomDate(null), []);

  const selectSlot = useCallback(
    (slot: DoctorTimeSlot) => setSelectedSlotStart(slot?.startTime ?? ''),
    [],
  );

  const clearSlot = useCallback(() => setSelectedSlotStart(''), []);

  const isReady = Boolean(selectedProfile && selectedLocation && selectedSlot);

  return {
    doctorDetailsRequest,
    patientProfilesRequest,
    fetchDoctorDetails,
    fetchPatientProfiles,
    doctor,
    patientProfiles,
    locations,
    selectedLocation,
    selectedLocationId: selectedLocation?.locationId ?? '',
    selectLocation: setSelectedLocationId,
    selectedProfile,
    selectedProfileId: selectedProfile?.patientProfileId ?? 0,
    selectProfile: setSelectedProfileId,
    weekdays,
    selectedDayIndex,
    selectDayIndex: setSelectedDayIndex,
    customDate,
    handlePickCustomDate,
    handleStartCustomDate,
    handleUseWeekdays,
    date,
    dateKey,
    slots,
    slotsForDay,
    selectedSlot,
    selectSlot,
    clearSlot,
    isSlotOver,
    consultationOptions,
    consultationType,
    setConsultationType,
    amount,
    chiefComplaint,
    setChiefComplaint,
    feeRangeLabel,
    relationshipLabel,
    taka,
    siteCount: locations?.length ?? 0,
    isReady,
  };
};

export default useCreateAppointmentViewModel;
