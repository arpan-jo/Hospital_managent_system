import apiRequest from '../network/apiRequest';
import { MessageRepository, unreadMessagesOf } from './MessageRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('MessageRepository.getThreads', () => {
  beforeEach(() => request.mockReset());

  it('reads each thread with its last message and unread count, latest first as sent', async () => {
    request.mockResolvedValueOnce([
      {
        doctorEmployeeId: 23248,
        doctorName: 'Dr. Ahsan Habib',
        doctorSpecialty: 'Senior Consultant',
        doctorPhotoUrl: null,
        patientRegistrationId: 2313,
        patientName: 'Alamin',
        patientCode: 'REG-2026-0178',
        lastMessage: ' Take it after meals. ',
        lastSenderType: 'doctor',
        lastAt: '2026-11-08T15:20:00',
        unreadCount: 2,
        messages: [],
      },
      { doctorEmployeeId: 7, patientRegistrationId: 9, lastSenderType: null, unreadCount: -1 },
      // Not a thread the screen can open.
      { doctorEmployeeId: 0, patientRegistrationId: 9 },
      null,
    ]);

    const threads = await MessageRepository.getThreads();

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/portal/messages/GetThreads', method: 'GET' }),
    );
    expect(threads).toHaveLength(2);
    expect(threads[0]).toEqual({
      doctorEmployeeId: 23248,
      doctorName: 'Dr. Ahsan Habib',
      doctorSpecialty: 'Senior Consultant',
      doctorPhotoUrl: '',
      patientRegistrationId: 2313,
      patientName: 'Alamin',
      patientCode: 'REG-2026-0178',
      lastMessage: 'Take it after meals.',
      lastSenderType: 'doctor',
      lastAt: '2026-11-08T15:20:00',
      unreadCount: 2,
      messages: [],
    });
    expect(threads[1]).toMatchObject({ lastSenderType: null, unreadCount: 0, lastMessage: '' });
  });

  it('treats an answer that is not a list as a failure', async () => {
    request.mockResolvedValueOnce({ message: 'nope' });
    await expect(MessageRepository.getThreads()).rejects.toThrow();
  });
});

describe('MessageRepository.getThread', () => {
  beforeEach(() => request.mockReset());

  it('asks for one registration with one doctor and keeps the messages oldest first', async () => {
    request.mockResolvedValueOnce({
      doctorEmployeeId: 23248,
      patientRegistrationId: 2313,
      unreadCount: 0,
      messages: [
        { messageId: 1, senderType: 'patient', message: 'Hello\nDoctor', isRead: true, createdAt: '2026-11-08T10:00:00' },
        { messageId: 2, senderType: 'Doctor', message: 'Hi', isRead: true, createdAt: '2026-11-08T10:05:00' },
        { messageId: 3, senderType: 'nurse', message: null },
      ],
    });

    const thread = await MessageRepository.getThread(2313, 23248);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/messages/GetThread',
        method: 'GET',
        params: { patientRegistrationId: 2313, doctorEmployeeId: 23248 },
      }),
    );
    expect(thread.messages.map(m => [m.messageId, m.senderType, m.message])).toEqual([
      [1, 'patient', 'Hello\nDoctor'],
      [2, 'doctor', 'Hi'],
      [3, 'patient', ''],
    ]);
  });

  it('treats a list or nothing as a failure', async () => {
    request.mockResolvedValueOnce([]);
    await expect(MessageRepository.getThread(1, 2)).rejects.toThrow();
    request.mockResolvedValueOnce(null);
    await expect(MessageRepository.getThread(1, 2)).rejects.toThrow();
  });
});

describe('MessageRepository.getDoctors', () => {
  beforeEach(() => request.mockReset());

  it("lists the registration's doctors and drops one without an id", async () => {
    request.mockResolvedValueOnce([
      { employeeId: 23248, fullName: 'Dr. Ahsan Habib', specialty: 'Senior Consultant', photoUrl: '' },
      { employeeId: 0, fullName: 'Nobody' },
    ]);

    const doctors = await MessageRepository.getDoctors(2313);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/messages/GetDoctors',
        params: { patientRegistrationId: 2313 },
      }),
    );
    expect(doctors).toEqual([
      { employeeId: 23248, fullName: 'Dr. Ahsan Habib', specialty: 'Senior Consultant', photoUrl: '' },
    ]);
  });
});

describe('MessageRepository.send', () => {
  beforeEach(() => request.mockReset());

  it('posts the trimmed message for the registration and doctor', async () => {
    request.mockResolvedValueOnce({
      messageId: 11,
      senderType: 'patient',
      message: 'Is the dose right?',
      isRead: false,
      createdAt: '2026-11-08T16:00:00',
    });

    const sent = await MessageRepository.send({
      patientRegistrationId: 2313,
      doctorEmployeeId: 23248,
      message: '  Is the dose right?  ',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/messages/Send',
        method: 'POST',
        data: { patientRegistrationId: 2313, doctorEmployeeId: 23248, message: 'Is the dose right?' },
      }),
    );
    expect(sent).toMatchObject({ messageId: 11, senderType: 'patient' });
  });

  it('gives a send 30 seconds, so a slow line does not read a saved message as failed', async () => {
    request.mockResolvedValueOnce({ messageId: 12, senderType: 'patient', message: 'Hi' });

    await MessageRepository.send({ patientRegistrationId: 1, doctorEmployeeId: 2, message: 'Hi' });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30_000 }));
  });
});

describe('unreadMessagesOf', () => {
  it('adds up every thread', () => {
    expect(
      unreadMessagesOf([{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 3 }] as any),
    ).toBe(5);
  });

  it('is 0 for nothing', () => {
    expect(unreadMessagesOf(null)).toBe(0);
    expect(unreadMessagesOf(undefined)).toBe(0);
  });
});
