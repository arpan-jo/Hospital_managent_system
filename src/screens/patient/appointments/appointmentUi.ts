/**
 * How an appointment reads on screen, shared by the list and the detail:
 * status, consultation type and payment labels and colours, as the portal
 * shows them.
 */
import {
  AppointmentPaymentStatus,
  AppointmentStatus,
  stripHonorific,
} from '@app/core';

type Tone = { color: string; tint: string };

const STATUS_LIGHT: Record<AppointmentStatus, Tone> = {
  pending: { color: '#B27400', tint: '#FEF3E0' },
  confirmed: { color: '#2F55D4', tint: '#EAF0FF' },
  completed: { color: '#1B8A4B', tint: '#E6F6EC' },
  cancelled: { color: '#C62828', tint: '#FDECEC' },
  no_show: { color: '#5F6478', tint: '#EEEFF4' },
};

/** The same states on a dark surface — light tints would glare there. */
const STATUS_DARK: Record<AppointmentStatus, Tone> = {
  pending: { color: '#F5C26B', tint: '#3A2E14' },
  confirmed: { color: '#9FB4FF', tint: '#1F2A4F' },
  completed: { color: '#6FD3A0', tint: '#173126' },
  cancelled: { color: '#F2B8B5', tint: '#3A1F1E' },
  no_show: { color: '#B9BFD4', tint: '#272B3A' },
};

export const statusTone = (status: AppointmentStatus, isDark?: boolean): Tone =>
  (isDark ? STATUS_DARK : STATUS_LIGHT)[status] ?? STATUS_LIGHT.pending;

export const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  pending: 'appointments.status.pending',
  confirmed: 'appointments.status.confirmed',
  completed: 'appointments.status.completed',
  cancelled: 'appointments.status.cancelled',
  no_show: 'appointments.status.absent',
};

/** The portal's consultation types. Anything else reads as a new patient, as there. */
const TYPES: Record<string, { labelKey: string; icon: string }> = {
  new_patient: { labelKey: 'appointments.type.newPatient', icon: 'account-plus-outline' },
  follow_up: { labelKey: 'appointments.type.followUp', icon: 'repeat-variant' },
  report: { labelKey: 'appointments.type.report', icon: 'file-document-outline' },
  visit: { labelKey: 'appointments.type.visit', icon: 'hospital-building' },
  telemedicine: { labelKey: 'appointments.type.telemedicine', icon: 'monitor-cellphone' },
  video: { labelKey: 'appointments.type.video', icon: 'video-outline' },
  audio: { labelKey: 'appointments.type.audio', icon: 'phone-outline' },
};

export const appointmentType = (type?: string) => TYPES[type ?? ''] ?? TYPES.new_patient;

/** A consultation held over a call has no place to go to. */
export const isRemoteType = (type?: string): boolean =>
  type === 'telemedicine' || type === 'video' || type === 'audio';

const PAYMENT: Record<AppointmentPaymentStatus, { labelKey: string; tone: Tone; toneDark: Tone }> = {
  paid: {
    labelKey: 'appointments.payment.paid',
    tone: { color: '#1B8A4B', tint: '#E6F6EC' },
    toneDark: { color: '#6FD3A0', tint: '#173126' },
  },
  partial: {
    labelKey: 'appointments.payment.partial',
    tone: { color: '#B27400', tint: '#FEF3E0' },
    toneDark: { color: '#F5C26B', tint: '#3A2E14' },
  },
  unpaid: {
    labelKey: 'appointments.payment.unpaid',
    tone: { color: '#5F6478', tint: '#EEEFF4' },
    toneDark: { color: '#B9BFD4', tint: '#272B3A' },
  },
  refund: {
    labelKey: 'appointments.payment.refunded',
    tone: { color: '#2F55D4', tint: '#EAF0FF' },
    toneDark: { color: '#9FB4FF', tint: '#1F2A4F' },
  },
};

export const paymentBadge = (status: AppointmentPaymentStatus, isDark?: boolean) => {
  const entry = PAYMENT[status] ?? PAYMENT.unpaid;
  return { labelKey: entry.labelKey, tone: isDark ? entry.toneDark : entry.tone };
};

/** "Dr." in front, as the portal names doctors — once, whatever the stored name carries. */
export const doctorDisplayName = (name?: string): string => {
  const bare = stripHonorific(name);
  return bare ? `Dr. ${bare}` : '';
};
