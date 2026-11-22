import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { groupThousands } from '@app/core';

/** `paymentStatus` as the API spells it — compared in lower case, since it is not consistent. */
const PAYMENT_STATUS_LABEL_KEY: Record<string, string> = {
  paid: 'bookingSuccess.paid',
  unpaid: 'bookingSuccess.unpaid',
  partial: 'bookingSuccess.partial',
};

export interface BookingSuccessInput {
  paymentStatus: string;
  amount: number;
}

/**
 * The success screen renders the booking the API just confirmed, so the only
 * work here is labelling the payment: a portal booking is paid in cash at the
 * desk, and the API says how much of it is settled.
 */
export const useBookingSuccessViewModel = (input: BookingSuccessInput) => {
  const { t } = useTranslation();

  const paymentStatus = input?.paymentStatus ?? '';
  const amount = input?.amount ?? 0;

  /** "Cash · Unpaid". An unmapped status falls back to the server's own word. */
  const paymentLabel = useMemo(() => {
    const statusKey = PAYMENT_STATUS_LABEL_KEY[paymentStatus?.toLowerCase?.() ?? ''];
    const status = statusKey ? t(statusKey) : paymentStatus;

    return [t('bookingSuccess.cash'), status]?.filter(Boolean)?.join(' · ');
  }, [paymentStatus, t]);

  // Only a free consultation (a doctor set up at ৳0) is booked at 0.
  const isFree = !(amount > 0);
  const amountLabel = useMemo(
    () => (isFree ? t('doctorProfile.free') : `৳${groupThousands(amount)}`),
    [isFree, amount, t],
  );

  /**
   * Whether to show how it is paid. Not for a free consultation: there is
   * nothing to pay, and "Free" beside "Cash · Unpaid" reads as a contradiction.
   * The portal shows no payment line for any booking. The booking itself is
   * the same either way.
   */
  const showPayment = !isFree;

  return { paymentLabel, amountLabel, showPayment };
};

export default useBookingSuccessViewModel;
