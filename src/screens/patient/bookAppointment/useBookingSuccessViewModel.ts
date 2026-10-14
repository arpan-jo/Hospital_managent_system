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

  const amountLabel = useMemo(
    () => (amount > 0 ? `৳${groupThousands(amount)}` : t('common.na')),
    [amount, t],
  );

  return { paymentLabel, amountLabel };
};

export default useBookingSuccessViewModel;
