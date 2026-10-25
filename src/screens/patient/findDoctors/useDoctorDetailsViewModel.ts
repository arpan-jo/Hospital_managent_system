import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppointmentBookingRepository,
  AvailableSlot,
  ConsultBookedResult,
  ConsultationType,
  DoctorConsultationDetail,
  FindDoctorsRepository,
  formatLongDate,
  PatientProfile,
  PatientRepository,
  PortalDoctor,
  serverMessageOf,
  to12Hour,
  toBookingFailure,
  useStores,
  withDoctorTitle,
} from '@app/core';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { dayAbbrOfDate, dayIndexOf, nextDateForDay } from './weekdays';

export type DoctorTab = 'schedule' | 'about' | 'reviews';

/** One visit type the doctor offers, with the fee it is booked at. */
export interface ConsultationOption {
  type: ConsultationType;
  /** Translation key of its name. */
  labelKey: string;
  fee: number;
}

/** A placed booking, with what the success screen shows about it. */
export interface PlacedBooking {
  result: ConsultBookedResult;
  consultationLabelKey: string;
  amount: number;
}

export type BookingOutcome =
  | { ok: true; booking: PlacedBooking }
  | { ok: false; message: string };

/** The visit types the portal books, in its order, each tied to the fee that prices it. */
const CONSULTATION_TYPES: {
  type: ConsultationType;
  labelKey: string;
  feeOf: (detail: DoctorConsultationDetail) => number;
}[] = [
  { type: 'new_patient', labelKey: 'doctorProfile.newPatient', feeOf: detail => detail?.fee ?? 0 },
  { type: 'follow_up', labelKey: 'doctorProfile.followUpVisit', feeOf: detail => detail?.followUpFee ?? 0 },
  { type: 'report', labelKey: 'doctorProfile.reportVisit', feeOf: detail => detail?.reportVisitFee ?? 0 },
];

const NOT_FOUND = 404;

/**
 * A doctor's page, as the portal has it: who the doctor is, and the booking —
 * a date, one of that date's windows, optionally a time inside it, a visit
 * type and a complaint — confirmed in one request.
 *
 * The doctor is read by `employeeId`; the row that comes back carries the
 * account, branch and office every later call needs. The visit is always for
 * the signed-in patient's own profile.
 */
export const useDoctorDetailsViewModel = (employeeId: number) => {
  const { t } = useTranslation();
  const { authStore, profileStore } = useStores();
  const monthNames = useMonthNames();

  const [doctor, setDoctor] = useState<PortalDoctor | null>(null);
  const [detail, setDetail] = useState<DoctorConsultationDetail | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** The server's words when the doctor could not be read; '' when it said none. */
  const [loadError, setLoadError] = useState('');
  /** The server's words when the doctor's terms could not be read. */
  const [detailError, setDetailError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState<DoctorTab>('schedule');

  const [date, setDate] = useState('');
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  /**
   * The window as it was when picked. Kept whole, as on the web, so the choice
   * stays on screen even if a later read of the day's windows fails or no
   * longer lists it.
   */
  const [pickedSlot, setPickedSlot] = useState<AvailableSlot | null>(null);
  const selectedSlotId = pickedSlot?.slotId ?? 0;
  /** A time picked inside the window; '' leaves the choice to the server ("Auto"). */
  const [subSlotTime, setSubSlotTime] = useState('');
  const [isSubSlotsOpen, setIsSubSlotsOpen] = useState(false);
  const [consultationType, setConsultationType] = useState<ConsultationType | ''>('');
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  /** Bumped by every slot request, so an answer for an earlier date is dropped. */
  const slotsRequestRef = useRef(0);
  /** Bumped by every load, so one doctor's answer never lands on another's page. */
  const loadRequestRef = useRef(0);
  /**
   * Set the moment a booking is sent. `isBooking` only changes on the next
   * render, so a second tap before it would place a second appointment — and
   * the server, given "Auto", would just give that one the next time.
   */
  const bookingInFlightRef = useRef(false);

  // ── The doctor, their terms, and the patient the visit is for ───────────────

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const isCurrent = () => requestId === loadRequestRef.current;

    setIsLoading(true);
    setLoadError('');
    setDetailError('');
    setIsNotFound(false);
    // Whatever was chosen belonged to the page as it was.
    setDate('');
    setPickedSlot(null);
    setSubSlotTime('');
    setIsSubSlotsOpen(false);
    setConsultationType('');
    setIsConfirming(false);

    try {
      const row = await FindDoctorsRepository.getDoctorById(employeeId);
      if (!isCurrent()) return;
      if (!row) {
        setDoctor(null);
        setIsNotFound(true);
        return;
      }
      setDoctor(row);

      // The two reads are independent; neither blocks the page if it fails —
      // the booking's own checks say what is missing.
      let termsError = '';
      const [terms, profile] = await Promise.all([
        AppointmentBookingRepository.getConsultationDetail(row).catch(error => {
          console.log('getConsultationDetail error ==>', error?.message);
          termsError = serverMessageOf(error);
          return null;
        }),
        PatientRepository.getProfile().catch(error => {
          console.log('[DoctorDetails] getProfile error ==>', error?.message);
          // No profile on the server: the kept one below must not stand in.
          if (error?.status === NOT_FOUND) profileStore.clear();
          return null;
        }),
      ]);

      if (!isCurrent()) return;

      // A profile kept from before the registration id was stored has none;
      // booking for registration 0 would be booking for nobody.
      const kept = profileStore.patientProfileData;
      setDetail(terms);
      setDetailError(termsError);
      setPatient(profile ?? ((kept?.registrationId ?? 0) > 0 ? kept : null));
      if (profile) profileStore.setPatientProfile(profile);
    } catch (error: any) {
      if (!isCurrent()) return;

      console.log('getDoctorById error ==>', error?.message);
      setDoctor(null);
      if (error?.status === NOT_FOUND) {
        setIsNotFound(true);
      } else {
        setLoadError(serverMessageOf(error));
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [employeeId, profileStore]);

  /** Reads the doctor's terms again — the page is usable without them, but nothing can be booked. */
  const reloadDetail = useCallback(async () => {
    if (!doctor) return;

    try {
      setDetail(await AppointmentBookingRepository.getConsultationDetail(doctor));
      setDetailError('');
    } catch (error: any) {
      console.log('getConsultationDetail error ==>', error?.message);
      setDetailError(serverMessageOf(error));
    }
  }, [doctor]);

  useEffect(() => {
    load();
  }, [load]);

  const patientRegistrationId = patient?.registrationId ?? 0;

  // ── Slots of the chosen date ────────────────────────────────────────────────

  const fetchSlots = useCallback(async () => {
    if (!doctor || !date) {
      setSlots([]);
      return;
    }

    const requestId = ++slotsRequestRef.current;
    setIsSlotsLoading(true);

    try {
      const response = await AppointmentBookingRepository.getAvailableSlots({
        employeeId: doctor?.employeeId,
        accountId: doctor?.accountId,
        branchId: doctor?.branchId,
        appointmentDate: date,
        patientRegistrationId,
      });
      if (requestId !== slotsRequestRef.current) return;
      setSlots(response ?? []);
    } catch (error: any) {
      if (requestId !== slotsRequestRef.current) return;
      console.log('getAvailableSlots error ==>', error?.message);
      setSlots([]);
    } finally {
      if (requestId === slotsRequestRef.current) setIsSlotsLoading(false);
    }
  }, [doctor, date, patientRegistrationId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ── What the choices are ────────────────────────────────────────────────────

  /** Only a visit type with a fee set is offered. */
  const consultationOptions = useMemo<ConsultationOption[]>(
    () =>
      detail
        ? CONSULTATION_TYPES.map(option => ({
            type: option.type,
            labelKey: option.labelKey,
            fee: option.feeOf(detail),
          })).filter(option => option.fee > 0)
        : [],
    [detail],
  );

  // The first one offered is chosen until the patient picks another.
  useEffect(() => {
    if (!consultationType && consultationOptions.length > 0) {
      setConsultationType(consultationOptions[0]?.type ?? '');
    }
  }, [consultationOptions, consultationType]);

  const selectedOption = useMemo(
    () => consultationOptions.find(option => option.type === consultationType) ?? null,
    [consultationOptions, consultationType],
  );
  const currentFee = selectedOption?.fee ?? 0;

  /** The weekdays the doctor sits — the only ones a weekday pill can pick. */
  const scheduledDays = useMemo(
    () => new Set(detail?.scheduledDays ?? []),
    [detail?.scheduledDays],
  );

  /** The chosen window, re-read from the latest list so its counts stay current. */
  const selectedSlot = useMemo(
    () => slots.find(slot => slot?.slotId === selectedSlotId) ?? pickedSlot,
    [slots, selectedSlotId, pickedSlot],
  );

  /** What "Auto" would give right now — a preview; the server makes the real choice. */
  const autoTime = useMemo(() => {
    const subSlots = selectedSlot?.subSlots ?? [];
    return (
      subSlots.find(sub => !sub?.isBooked && !sub?.isPast)?.startTime ||
      subSlots.find(sub => !sub?.isBooked)?.startTime ||
      ''
    );
  }, [selectedSlot]);

  /** The time shown for the booking — never sent as such. */
  const bookingTime = subSlotTime || autoTime || selectedSlot?.startTime || '';

  const officeName = detail?.officeName || doctor?.location || '';
  const displayName = useMemo(
    () => withDoctorTitle(doctor?.fullName),
    [doctor?.fullName],
  );

  /** "Wednesday" for the chosen date, from the `dayNames` locale block. */
  const dayName = useMemo(() => {
    const index = dayIndexOf(dayAbbrOfDate(date));
    return index >= 0 ? t(`dayNames.${index}`) : '';
  }, [date, t]);

  const canBook = Boolean(date) && selectedSlotId > 0;

  // ── Choosing ────────────────────────────────────────────────────────────────

  const pickDate = useCallback((next: string) => {
    setDate(next);
    setPickedSlot(null);
    setSubSlotTime('');
    setIsSubSlotsOpen(false);
  }, []);

  const pickWeekday = useCallback(
    (abbr: string) => pickDate(nextDateForDay(abbr)),
    [pickDate],
  );

  /** A weekday pill is lit when the chosen date is the one it stands for. */
  const isWeekdayActive = useCallback(
    (abbr: string) => Boolean(date) && date === nextDateForDay(abbr),
    [date],
  );

  const toggleCustomDate = useCallback(() => setIsCustomDate(prev => !prev), []);

  const pickSlot = useCallback((slot: AvailableSlot) => {
    setPickedSlot(slot ?? null);
    setSubSlotTime('');
    setIsSubSlotsOpen(false);
  }, []);

  const clearSelection = useCallback(() => {
    setPickedSlot(null);
    setSubSlotTime('');
    setIsConfirming(false);
  }, []);

  const toggleSubSlots = useCallback(() => setIsSubSlotsOpen(prev => !prev), []);

  const openConfirmation = useCallback(() => {
    if (canBook) setIsConfirming(true);
  }, [canBook]);
  const closeConfirmation = useCallback(() => setIsConfirming(false), []);

  // ── Booking ─────────────────────────────────────────────────────────────────

  /**
   * Places the booking. On a refusal the reason comes back as a message and the
   * screen is left ready for another try: the confirmation closes, and when the
   * time itself was lost the window's times are read again.
   */
  const book = useCallback(async (): Promise<BookingOutcome> => {
    if (bookingInFlightRef.current) return { ok: false, message: '' };

    // A refusal closes the confirmation, so the reason is not hidden under it.
    const refuse = (message: string): BookingOutcome => {
      setIsConfirming(false);
      return { ok: false, message };
    };

    // The same checks, in the same order, as the portal makes.
    if (!date) return refuse(t('doctorProfile.selectDate'));
    if (!selectedSlotId) return refuse(t('doctorProfile.selectSlot'));
    if (!consultationType || !selectedOption) {
      return refuse(t('doctorProfile.selectConsultationType'));
    }
    if (!doctor || !patient) return refuse(t('doctorProfile.selectPatient'));

    bookingInFlightRef.current = true;
    setIsBooking(true);
    try {
      const result = await AppointmentBookingRepository.createAppointment({
        doctorId: doctor?.employeeId,
        patientRegistrationId,
        accountId: doctor?.accountId,
        branchId: doctor?.branchId,
        officeId: doctor?.officeId,
        userId: authStore.user?.userId ?? 0,
        appointmentDate: date,
        slotId: selectedSlotId,
        time: subSlotTime,
        type: consultationType,
        reason,
        paymentAmount: currentFee,
      });

      // A booking can move the registration to the doctor's hospital, and that
      // re-issues the patient code. Read the profile again, as the portal does,
      // so the drawer and My Profile do not keep the old code.
      PatientRepository.getProfile()
        .then(profile => {
          if (profile) profileStore.setPatientProfile(profile);
        })
        .catch(error => console.log('[DoctorDetails] profile refresh error ==>', error?.message));

      return {
        ok: true,
        booking: {
          result,
          consultationLabelKey: selectedOption.labelKey,
          amount: currentFee,
        },
      };
    } catch (error: any) {
      const failure = toBookingFailure(error);
      const suggested = failure?.suggestedSlot;
      setIsConfirming(false);

      // The server always words these itself but leaves the suggested time out
      // of its sentence, so the suggestion goes on a line of its own below it.
      if (failure?.code === 'SLOT_FULL' && suggested) {
        const params = {
          date: formatLongDate(suggested?.date ?? '', monthNames),
          time: to12Hour(suggested?.time || suggested?.startTime || ''),
        };
        const next =
          params.date && params.time
            ? t('doctorProfile.nextOpening', params)
            : '';
        return {
          ok: false,
          message: failure?.message
            ? [failure.message, next].filter(Boolean).join('\n')
            : next
              ? t('doctorProfile.slotFull', params)
              : t('doctorProfile.bookingFailed'),
        };
      }

      if (failure?.code === 'SUB_SLOT_TAKEN') {
        // Back to "Auto", with the times open and read afresh.
        setSubSlotTime('');
        setIsSubSlotsOpen(true);
        fetchSlots();
        const next = suggested?.time
          ? t('doctorProfile.nextFreeTime', { time: to12Hour(suggested.time) })
          : '';
        return {
          ok: false,
          message: failure?.message
            ? [failure.message, next].filter(Boolean).join('\n')
            : suggested?.time
              ? t('doctorProfile.timeTakenNext', { time: to12Hour(suggested.time) })
              : t('doctorProfile.timeTaken'),
        };
      }

      return {
        ok: false,
        message: failure?.message || t('doctorProfile.bookingFailed'),
      };
    } finally {
      bookingInFlightRef.current = false;
      setIsBooking(false);
    }
  }, [
    date,
    selectedSlotId,
    consultationType,
    selectedOption,
    doctor,
    patient,
    patientRegistrationId,
    authStore.user?.userId,
    profileStore,
    subSlotTime,
    reason,
    currentFee,
    fetchSlots,
    monthNames,
    t,
  ]);

  return {
    doctor,
    detail,
    patient,
    isLoading,
    loadError,
    detailError,
    isNotFound,
    reload: load,
    reloadDetail,
    displayName,
    officeName,
    activeTab,
    setActiveTab,
    // date
    date,
    dayName,
    isCustomDate,
    toggleCustomDate,
    scheduledDays,
    pickDate,
    pickWeekday,
    isWeekdayActive,
    // slots
    slots,
    isSlotsLoading,
    selectedSlot,
    selectedSlotId,
    pickSlot,
    clearSelection,
    // times inside a window
    subSlotTime,
    setSubSlotTime,
    isSubSlotsOpen,
    toggleSubSlots,
    autoTime,
    bookingTime,
    // visit type and complaint
    consultationOptions,
    consultationType,
    setConsultationType,
    selectedOption,
    currentFee,
    reason,
    setReason,
    // confirmation
    canBook,
    isConfirming,
    openConfirmation,
    closeConfirmation,
    isBooking,
    book,
  };
};

export type DoctorDetailsViewModel = ReturnType<typeof useDoctorDetailsViewModel>;

export default useDoctorDetailsViewModel;
