import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppointmentRepository,
  AppointmentType,
  CreatedAppointment,
  DoctorDetailsInfo,
  DoctorDetailsRepository,
  PaymentMethod,
  groupThousands,
} from '@app/core';
import { RequestState } from './useFindDoctorsViewModel';

/**
 * The booking flow has no payment step — the chamber collects the fee — so the
 * request always books as cash and the API decides the payment status.
 */
export const BOOKING_PAYMENT_METHOD: PaymentMethod = 'cash';

/** Every `strType` the patient app can book, mapped to its display copy. */
export const CONSULTATION_LABEL_KEY: Record<AppointmentType, string> = {
  in_person: 'booking.inPersonVisit',
  follow_up: 'booking.followUpVisit',
  report: 'booking.reportVisit',
  audio: 'doctorProfile.audioConsultation',
  video: 'doctorProfile.videoConsultation',
};

export interface ConfirmAppointmentInput {
  doctorId: string;
  patientCode: string;
  locationId: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** The slot's raw start time ('09:00'), not the display label. */
  slotStart: string;
  consultationType: AppointmentType;
  chiefComplaint: string;
  amount: number;
}

const EMPTY_DOCTOR_REQUEST: RequestState<DoctorDetailsInfo | null> = {
  isLoading: false,
  data: null,
  error: null,
};

/**
 * The confirmation step: it re-reads the doctor for the header card and owns
 * the `POST /api/appointments` call. Everything else being confirmed already
 * arrived as route params, so the screen stays a pure view.
 */
export const useConfirmAppointmentViewModel = (
  input: ConfirmAppointmentInput,
) => {
  const { t } = useTranslation();

  const doctorId = input?.doctorId ?? '';
  const patientCode = input?.patientCode ?? '';
  const locationId = input?.locationId ?? '';
  const date = input?.date ?? '';
  const slotStart = input?.slotStart ?? '';
  const consultationType = input?.consultationType ?? 'in_person';
  const chiefComplaint = input?.chiefComplaint ?? '';
  const amount = input?.amount ?? 0;

  const [doctorRequest, setDoctorRequest] = useState<
    RequestState<DoctorDetailsInfo | null>
  >({ ...EMPTY_DOCTOR_REQUEST, isLoading: true });

  const [bookingRequest, setBookingRequest] = useState<
    RequestState<CreatedAppointment | null>
  >({ isLoading: false, data: null, error: null });

  const fetchDoctorDetails = useCallback(async () => {
    // A deep link can land on this screen without an id — nothing to fetch.
    if (!doctorId) {
      setDoctorRequest(EMPTY_DOCTOR_REQUEST);
      return;
    }

    setDoctorRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await DoctorDetailsRepository.getDoctorDetails(doctorId);
      setDoctorRequest({ isLoading: false, data: response ?? null, error: null });
    } catch (error: any) {
      console.log('fetchDoctorDetails error ==>', error?.message);
      setDoctorRequest({
        isLoading: false,
        data: null,
        error: error?.message ?? null,
      });
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  /**
   * Books the appointment and hands the created row back, so the view can move
   * on to the success screen with the server's own token, fee and status.
   */
  const confirmBooking =
    useCallback(async (): Promise<CreatedAppointment | null> => {
      if (bookingRequest?.isLoading) return null;

      setBookingRequest({ isLoading: true, data: null, error: null });

      try {
        const created = await AppointmentRepository.createAppointment({
          doctorUserId: doctorId,
          locationId,
          appointmentDate: date,
          time: slotStart,
          type: consultationType,
          patientCode,
          paymentMethod: BOOKING_PAYMENT_METHOD,
          reason: chiefComplaint,
        });

        setBookingRequest({ isLoading: false, data: created ?? null, error: null });
        return created ?? null;
      } catch (error: any) {
        console.log('createAppointment error ==>', error?.message);
        setBookingRequest({
          isLoading: false,
          data: null,
          error: error?.message ?? t('common.noDataFound'),
        });
        return null;
      }
    }, [
      bookingRequest?.isLoading,
      doctorId,
      locationId,
      date,
      slotStart,
      consultationType,
      patientCode,
      chiefComplaint,
      t,
    ]);

  const dismissError = useCallback(
    () => setBookingRequest(prev => ({ ...prev, error: null })),
    [],
  );

  const consultationLabel = useMemo(
    () =>
      t(
        CONSULTATION_LABEL_KEY[consultationType] ??
          CONSULTATION_LABEL_KEY.in_person,
      ),
    [t, consultationType],
  );

  const amountLabel = useMemo(() => `৳${groupThousands(amount)}`, [amount]);

  return {
    doctorRequest,
    doctor: doctorRequest?.data ?? null,
    fetchDoctorDetails,
    bookingRequest,
    confirmBooking,
    dismissError,
    consultationLabel,
    amountLabel,
  };
};

export default useConfirmAppointmentViewModel;
