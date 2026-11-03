import { notificationTarget, toNotificationTimestamp } from './notifications';

describe('toNotificationTimestamp', () => {
  it('reads an offset-less stamp as Bangladesh time', () => {
    // As devmgm sent it on 2026-11-03: 12:06 in Dhaka, which is 06:06 UTC.
    const stamp = toNotificationTimestamp('2026-10-28T12:06:01.1263996');
    expect(stamp).toBe('2026-10-28T12:06:01.126+06:00');
    expect(new Date(stamp).toISOString()).toBe('2026-10-28T06:06:01.126Z');
  });

  it('keeps a stamp that already names its zone', () => {
    expect(toNotificationTimestamp('2026-10-28T06:06:01.1263996Z')).toBe('2026-10-28T06:06:01.126Z');
    expect(toNotificationTimestamp('2026-10-28T12:06:01+06:00')).toBe('2026-10-28T12:06:01+06:00');
    expect(new Date(toNotificationTimestamp('2026-10-28T06:06:01Z')).toISOString()).toBe(
      '2026-10-28T06:06:01.000Z',
    );
  });

  it('leaves a bare date and an empty value alone', () => {
    expect(toNotificationTimestamp('2026-10-28')).toBe('2026-10-28');
    expect(toNotificationTimestamp('')).toBe('');
    expect(toNotificationTimestamp(null)).toBe('');
    expect(toNotificationTimestamp(undefined)).toBe('');
  });
});

describe('notificationTarget', () => {
  it("opens an appointment's own page", () => {
    // AppointmentService links the patient's notices this way.
    expect(notificationTarget('/appointments/3295')).toEqual({
      screen: 'appointment',
      appointmentId: 3295,
    });
    expect(notificationTarget(' /appointments/12/ ')).toEqual({
      screen: 'appointment',
      appointmentId: 12,
    });
  });

  it('opens the list a section link names', () => {
    expect(notificationTarget('/follow-ups')).toEqual({ screen: 'followUps' });
    expect(notificationTarget('/appointments')).toEqual({ screen: 'appointments' });
    expect(notificationTarget('/appointments/0')).toEqual({ screen: 'appointments' });
    expect(notificationTarget('/prescriptions/88')).toEqual({ screen: 'prescriptions' });
    expect(notificationTarget('/reports?tab=lab')).toEqual({ screen: 'reports' });
    expect(notificationTarget('/doctors/23248')).toEqual({ screen: 'findDoctors' });
    expect(notificationTarget('/Profile')).toEqual({ screen: 'profile' });
  });

  it('has nowhere to go for staff pages or no link', () => {
    expect(notificationTarget('/doctor/appointments')).toBeNull();
    expect(notificationTarget('/admin/dashboard')).toBeNull();
    expect(notificationTarget('')).toBeNull();
    expect(notificationTarget(null)).toBeNull();
    expect(notificationTarget(undefined)).toBeNull();
  });
});
