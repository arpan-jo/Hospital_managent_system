import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { AppointmentRepository } from './AppointmentRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('AppointmentRepository.getTodayQueue', () => {
  beforeEach(() => request.mockReset());

  it("reads where each of today's queues stands", async () => {
    request.mockResolvedValueOnce([
      {
        appointmentId: 41,
        status: 'Confirmed',
        time: '10:30:00',
        tokenNumber: 18,
        doctorEmployeeId: 7,
        doctorName: 'Dr. Nabid Alam',
        roomNumber: '204',
        nowServingToken: 12,
        aheadCount: 4,
        isCalled: false,
        patientName: 'Al Amin',
        patientRegistrationId: 2367,
      },
    ]);

    await expect(AppointmentRepository.getTodayQueue()).resolves.toEqual([
      {
        appointmentId: 41,
        status: 'confirmed',
        time: '10:30',
        tokenNumber: 18,
        doctorEmployeeId: 7,
        doctorName: 'Dr. Nabid Alam',
        roomNumber: '204',
        nowServingToken: 12,
        aheadCount: 4,
        isCalled: false,
        patientName: 'Al Amin',
        patientRegistrationId: 2367,
      },
    ]);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: ENDPOINTS.portalTodayQueue, method: 'GET' }),
    );
  });

  it('reads "nobody called yet" and a missing token as none, never as 0', async () => {
    request.mockResolvedValueOnce([
      { appointmentId: 42, status: 'pending', tokenNumber: null, nowServingToken: null, aheadCount: -2 },
    ]);

    const [entry] = await AppointmentRepository.getTodayQueue();
    expect(entry.tokenNumber).toBeNull();
    expect(entry.nowServingToken).toBeNull();
    expect(entry.aheadCount).toBe(0);
    expect(entry.isCalled).toBe(false);
    expect(entry.doctorName).toBe('');
  });

  it('keeps a now-serving 0 — someone without a token is being seen, so the queue has started', async () => {
    request.mockResolvedValueOnce([
      { appointmentId: 43, status: 'confirmed', tokenNumber: 0, nowServingToken: 0, aheadCount: 2 },
    ]);

    const [entry] = await AppointmentRepository.getTodayQueue();
    expect(entry.nowServingToken).toBe(0);
    // The patient's own token stays "none" at 0 — there is no token #0 to show.
    expect(entry.tokenNumber).toBeNull();
    expect(entry.aheadCount).toBe(2);
  });

  it('answers an empty list for anything that is not a list, and drops rows with no id', async () => {
    request.mockResolvedValueOnce(null);
    await expect(AppointmentRepository.getTodayQueue()).resolves.toEqual([]);

    request.mockResolvedValueOnce([{ status: 'confirmed' }, null]);
    await expect(AppointmentRepository.getTodayQueue()).resolves.toEqual([]);
  });
});

describe('AppointmentRepository.rescheduleAppointment', () => {
  beforeEach(() => request.mockReset());

  it('moves the appointment the way the portal does and reads the answer', async () => {
    request.mockResolvedValueOnce({
      appointmentId: 41,
      appointmentDate: '2026-11-12',
      time: '10:15:00',
      status: 'Pending',
      doctorEmployeeId: 7,
      patientRegistrationId: 2367,
      accountId: 1,
      branchId: 3,
    });

    const updated = await AppointmentRepository.rescheduleAppointment({
      appointmentId: 41,
      appointmentDate: '2026-11-12',
      slotId: 88,
      time: '10:15',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: ENDPOINTS.portalRescheduleAppointment,
        method: 'PATCH',
        data: { appointmentId: 41, appointmentDate: '2026-11-12', slotId: 88, time: '10:15' },
      }),
    );
    expect(updated).toMatchObject({ id: 41, status: 'pending', accountId: 1, branchId: 3 });
  });

  it('leaves the time to the server when none is picked', async () => {
    request.mockResolvedValueOnce(null);

    const updated = await AppointmentRepository.rescheduleAppointment({
      appointmentId: 41,
      appointmentDate: '2026-11-12',
      slotId: 88,
      time: '',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { appointmentId: 41, appointmentDate: '2026-11-12', slotId: 88, time: null },
      }),
    );
    expect(updated).toBeNull();
  });

  it("passes the desk's refusal on to the caller", async () => {
    request.mockRejectedValueOnce(new Error('Request failed with status code 409'));

    await expect(
      AppointmentRepository.rescheduleAppointment({ appointmentId: 41, appointmentDate: '2026-11-12', slotId: 88 }),
    ).rejects.toThrow('409');
  });
});
