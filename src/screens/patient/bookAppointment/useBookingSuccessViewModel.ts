import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DoctorDetailsInfo,
  DoctorDetailsRepository,
  groupThousands,
} from '@app/core';
// Shared request shape — one `{ isLoading, data, error }` object per API call.
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

/** `strPaymentMethod` / `strPaymentStatus` values as the API spells them. */
const PAYMENT_METHOD_LABEL_KEY: Record<string, string> = {
  cash: 'booking.method.cash',
  cheque: 'booking.method.cheque',
  card: 'booking.method.card',
  mobile_banking: 'booking.method.mobile',
};

const PAYMENT_STATUS_LABEL_KEY: Record<string, string> = {
  paid: 'bookingSuccess.paid',
  unpaid: 'bookingSuccess.unpaid',
  partial: 'bookingSuccess.partial',
};

export interface BookingSuccessInput {
  doctorId: string;
  /** Comes straight off the booking response; empty only on the older flow. */
  doctorName: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  dueAmount: number;
}

const EMPTY_DOCTOR_REQUEST: RequestState<DoctorDetailsInfo | null> = {
  isLoading: false,
  data: null,
  error: null,
};

/**
 * The success screen renders the `POST /api/appointments` response, so the only
 * work left here is labelling the server's payment strings and — for entry
 * points that arrive without the doctor — one fallback read.
 */
export const useBookingSuccessViewModel = (input: BookingSuccessInput) => {
  const { t } = useTranslation();

  const doctorId = input?.doctorId ?? '';
  const doctorName = input?.doctorName ?? '';
  const paymentMethod = input?.paymentMethod ?? '';
  const paymentStatus = input?.paymentStatus ?? '';
  const amount = input?.amount ?? 0;
  const dueAmount = input?.dueAmount ?? 0;

  const [doctorRequest, setDoctorRequest] = useState<
    RequestState<DoctorDetailsInfo | null>
  >(EMPTY_DOCTOR_REQUEST);

  const fetchDoctorDetails = useCallback(async () => {
    // The booking response already carries the doctor — only the older two-step
    // flow, which arrives without it, needs the extra read.
    if (!doctorId || doctorName) {
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
  }, [doctorId, doctorName]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  /**
   * "cash" + "unpaid" -> "Cash · Unpaid". Both words come from the API, so an
   * unmapped value falls back to the server's own string rather than a blank.
   */
  const paymentLabel = useMemo(() => {
    const methodKey = PAYMENT_METHOD_LABEL_KEY[paymentMethod];
    const method = methodKey ? t(methodKey) : paymentMethod;

    const statusKey = PAYMENT_STATUS_LABEL_KEY[paymentStatus];
    const status = statusKey ? t(statusKey) : paymentStatus;

    return [method, status]?.filter(Boolean)?.join(' · ') || t('common.na');
  }, [paymentMethod, paymentStatus, t]);

  const amountLabel = useMemo(() => `৳${groupThousands(amount)}`, [amount]);
  const dueAmountLabel = useMemo(
    () => `৳${groupThousands(dueAmount)}`,
    [dueAmount],
  );

  return {
    doctorRequest,
    doctor: doctorRequest?.data ?? null,
    fetchDoctorDetails,
    paymentLabel,
    amountLabel,
    dueAmountLabel,
    hasDue: dueAmount > 0,
  };
};

export default useBookingSuccessViewModel;
