import { useCallback, useEffect, useState } from 'react';
import {
  Appointment,
  AppointmentRepository,
  AppointmentStatus,
  Consultation,
  ConsultationRepository,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

/** Only an appointment the chamber has not resolved yet can still be cancelled. */
const CANCELLABLE_STATUSES: AppointmentStatus[] = ['pending', 'confirmed'];

/** Once the doctor has started the visit, cancelling stops making sense even
 * though the status is still 'pending'/'confirmed' — matches the web's
 * `!apt.hasConsultation` guard on its Cancel button. */
const canCancelAppointment = (appointment: Appointment | null): boolean =>
  CANCELLABLE_STATUSES.includes(appointment?.status as AppointmentStatus) &&
  !appointment?.hasConsultation;

const EMPTY_REQUEST: RequestState<Appointment | null> = {
  isLoading: false,
  data: null,
  error: null,
};

export const useAppointmentDetailsViewModel = (appointmentId: string) => {
  const [appointmentRequest, setAppointmentRequest] = useState<
    RequestState<Appointment | null>
  >({ ...EMPTY_REQUEST, isLoading: true });

  const [cancelRequest, setCancelRequest] =
    useState<RequestState<Appointment | null>>(EMPTY_REQUEST);

  const [consultationRequest, setConsultationRequest] = useState<
    RequestState<Consultation | null>
  >({ isLoading: false, data: null, error: null });

  const fetchAppointment = useCallback(async () => {
    // A deep link can land here without an id — nothing to fetch.
    if (!appointmentId) {
      setAppointmentRequest(EMPTY_REQUEST);
      return;
    }

    setAppointmentRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await AppointmentRepository.getAppointmentById(appointmentId);
      setAppointmentRequest({ isLoading: false, data: response ?? null, error: null });
    } catch (error: any) {
      console.log('getAppointmentById error ==>', error?.message);
      setAppointmentRequest({
        isLoading: false,
        data: null,
        error: error?.message ?? null,
      });
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const appointment = appointmentRequest?.data ?? null;
  const hasConsultation = Boolean(appointment?.hasConsultation);

  /**
   * Only read when the appointment says there is one — same guard as the
   * doctor's copy of this screen, and it spares the round trip on every
   * upcoming visit nobody has started yet.
   */
  useEffect(() => {
    if (!hasConsultation || !appointmentId) {
      setConsultationRequest({ isLoading: false, data: null, error: null });
      return;
    }

    let isCurrent = true;
    setConsultationRequest(prev => ({ ...prev, isLoading: true, error: null }));

    ConsultationRepository.getConsultation(appointmentId)
      .then(result => {
        if (isCurrent) {
          setConsultationRequest({ isLoading: false, data: result, error: null });
        }
      })
      .catch((error: any) => {
        console.log('getConsultation error ==>', error?.message);
        if (isCurrent) {
          setConsultationRequest({
            isLoading: false,
            data: null,
            error: error?.message ?? null,
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [appointmentId, hasConsultation]);

  /**
   * Cancels through `PATCH /status` and keeps the row the API sends back, so
   * the screen shows the server's state rather than an assumed one.
   */
  const cancelAppointment = useCallback(async (): Promise<Appointment | null> => {
    if (cancelRequest?.isLoading || !appointmentId) return null;

    setCancelRequest({ isLoading: true, data: null, error: null });

    try {
      const updated = await AppointmentRepository.updateStatus(appointmentId, 'cancelled');
      setCancelRequest({ isLoading: false, data: updated ?? null, error: null });

      if (updated) {
        setAppointmentRequest({ isLoading: false, data: updated, error: null });
      }
      return updated ?? null;
    } catch (error: any) {
      console.log('cancelAppointment error ==>', error?.message);
      setCancelRequest({
        isLoading: false,
        data: null,
        error: error?.message ?? null,
      });
      return null;
    }
  }, [appointmentId, cancelRequest?.isLoading]);

  return {
    appointment,
    isLoading: appointmentRequest?.isLoading ?? false,
    error: appointmentRequest?.error ?? null,
    isCancelling: cancelRequest?.isLoading ?? false,
    cancelError: cancelRequest?.error ?? null,
    canCancel: canCancelAppointment(appointment),
    cancelAppointment,
    consultation: consultationRequest?.data ?? null,
    isConsultationLoading: consultationRequest?.isLoading ?? false,
    refetch: fetchAppointment,
  };
};

export default useAppointmentDetailsViewModel;
