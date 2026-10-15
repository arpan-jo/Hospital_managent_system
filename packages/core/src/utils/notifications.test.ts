import { notificationTarget } from './notifications';

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
