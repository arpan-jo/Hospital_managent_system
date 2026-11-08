/**
 * Messages between the patient and the doctors they have seen, as the portal
 * runs them on `/hms/portal/messages`. A thread is one of the account's
 * registrations with one doctor; a patient may write to any doctor that
 * registration has had an appointment with (one not cancelled). A doctor's
 * reply also arrives as a portal notification.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** The backend refuses a longer message. */
export const MESSAGE_MAX_LENGTH = 2000;

export type MessageSender = 'patient' | 'doctor';

export interface PortalMessage {
  messageId: number;
  senderType: MessageSender;
  message: string;
  isRead: boolean;
  /** Bangladesh wall-clock, no zone. */
  createdAt: string;
}

export interface PortalMessageThread {
  doctorEmployeeId: number;
  doctorName: string;
  doctorSpecialty: string;
  /** A stored file's id or a url — run it through `getFileUrl`. */
  doctorPhotoUrl: string;
  patientRegistrationId: number;
  patientName: string;
  patientCode: string;
  lastMessage: string;
  /** Null while the thread has no message yet. */
  lastSenderType: MessageSender | null;
  lastAt: string;
  /** The doctor's messages the patient has not read yet. */
  unreadCount: number;
  /** Oldest first; only `getThread` fills it — the list comes without them. */
  messages: PortalMessage[];
}

/** A doctor a new thread can be started with. */
export interface PortalMessageDoctor {
  employeeId: number;
  fullName: string;
  specialty: string;
  photoUrl: string;
}

export interface SendMessageInput {
  patientRegistrationId: number;
  doctorEmployeeId: number;
  message: string;
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;
const toArray = (value: any): any[] => (Array.isArray(value) ? value : []);

/** Anything but the doctor's own is the patient's — the only two sides a thread has. */
const toSender = (value: any): MessageSender => (toText(value).toLowerCase() === 'doctor' ? 'doctor' : 'patient');

export const toPortalMessage = (raw: any): PortalMessage => ({
  messageId: toNumber(raw?.messageId),
  senderType: toSender(raw?.senderType),
  // Line breaks are the writer's own; only the ends are trimmed.
  message: String(raw?.message ?? '').trim(),
  isRead: Boolean(raw?.isRead),
  createdAt: toText(raw?.createdAt),
});

export const toPortalMessageThread = (raw: any): PortalMessageThread => ({
  doctorEmployeeId: toNumber(raw?.doctorEmployeeId),
  doctorName: toText(raw?.doctorName),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  patientRegistrationId: toNumber(raw?.patientRegistrationId),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
  lastMessage: String(raw?.lastMessage ?? '').trim(),
  lastSenderType: raw?.lastSenderType ? toSender(raw.lastSenderType) : null,
  lastAt: toText(raw?.lastAt),
  unreadCount: Math.max(0, toNumber(raw?.unreadCount)),
  messages: toArray(raw?.messages).map(toPortalMessage),
});

const toPortalMessageDoctor = (raw: any): PortalMessageDoctor => ({
  employeeId: toNumber(raw?.employeeId),
  fullName: toText(raw?.fullName),
  specialty: toText(raw?.specialty),
  photoUrl: toText(raw?.photoUrl),
});

/** Every unread message across the account's threads — the menu's badge and the home tile. */
export const unreadMessagesOf = (threads?: PortalMessageThread[] | null): number =>
  (threads ?? []).reduce((sum, thread) => sum + (thread?.unreadCount ?? 0), 0);

export const MessageRepository = {
  /** `GET GetDoctors` — whom this registration can write to; a registration not the caller's is a 404. */
  getDoctors: async (patientRegistrationId: number): Promise<PortalMessageDoctor[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalMessageDoctors,
      method: 'GET',
      baseUrl: API_URL,
      params: { patientRegistrationId: toNumber(patientRegistrationId) },
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected message doctors response');
    return response.map(toPortalMessageDoctor).filter(doctor => doctor.employeeId > 0);
  },

  /** `GET GetThreads` — the account's threads, latest first, without their messages. */
  getThreads: async (): Promise<PortalMessageThread[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalMessageThreads,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected message threads response');
    return response
      .map(toPortalMessageThread)
      .filter(thread => thread.doctorEmployeeId > 0 && thread.patientRegistrationId > 0);
  },

  /**
   * `GET GetThread` — one thread with every message, oldest first. Reading it
   * marks the doctor's messages as read, as on the portal.
   */
  getThread: async (patientRegistrationId: number, doctorEmployeeId: number): Promise<PortalMessageThread> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalMessageThread,
      method: 'GET',
      baseUrl: API_URL,
      params: {
        patientRegistrationId: toNumber(patientRegistrationId),
        doctorEmployeeId: toNumber(doctorEmployeeId),
      },
    };
    const response = await apiRequest<any>(api_params);
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Unexpected message thread response');
    }
    return toPortalMessageThread(response);
  },

  /**
   * `POST Send` — 400 with the reason for an empty or long message; 403 when the
   * registration has had no appointment with the doctor. Both carry the server's words.
   */
  send: async (input: SendMessageInput): Promise<PortalMessage> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalMessageSend,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        patientRegistrationId: toNumber(input?.patientRegistrationId),
        doctorEmployeeId: toNumber(input?.doctorEmployeeId),
        message: String(input?.message ?? '').trim(),
      },
    };
    const response = await apiRequest<any>(api_params);
    return toPortalMessage(response);
  },
};

export default MessageRepository;
