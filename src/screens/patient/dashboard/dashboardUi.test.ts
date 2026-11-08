import { AppointmentSummary, LabTest } from '@app/core';
import { nextAppointmentOf, reportCountsOf } from './dashboardUi';

const visit = (over: Partial<AppointmentSummary>): AppointmentSummary =>
  ({
    id: 1,
    date: '2026-11-09',
    time: '10:00',
    status: 'pending',
    type: 'new_patient',
    token: 0,
    doctorName: '',
    doctorSpecialty: '',
    doctorDesignation: '',
    doctorPhotoUrl: '',
    fee: 0,
    ...over,
  }) as AppointmentSummary;

describe('nextAppointmentOf', () => {
  const today = '2026-11-08';

  it('picks the earliest pending or confirmed visit from today on', () => {
    const next = nextAppointmentOf(
      [
        visit({ id: 1, date: '2026-11-12', time: '09:00' }),
        visit({ id: 2, date: '2026-11-09', time: '14:09', status: 'confirmed' }),
        visit({ id: 3, date: '2026-11-09', time: '11:00' }),
        visit({ id: 4, date: '2026-11-07', time: '08:00' }),
      ],
      today,
    );
    expect(next?.id).toBe(3);
  });

  it("counts today's visit as ahead", () => {
    expect(nextAppointmentOf([visit({ id: 5, date: '2026-11-08', time: '23:00' })], today)?.id).toBe(5);
  });

  it('leaves out a visit that is done, cancelled or missed', () => {
    const next = nextAppointmentOf(
      [
        visit({ id: 1, status: 'completed' }),
        visit({ id: 2, status: 'cancelled' }),
        visit({ id: 3, status: 'no_show' }),
      ],
      today,
    );
    expect(next).toBeNull();
  });

  it('is null for nothing, and ignores a visit without a date', () => {
    expect(nextAppointmentOf(null, today)).toBeNull();
    expect(nextAppointmentOf([visit({ date: '' })], today)).toBeNull();
  });
});

describe('reportCountsOf', () => {
  it('splits the tests into still to come and ready', () => {
    const tests = [{ isReportReady: true }, { isReportReady: false }, { isReportReady: false }] as LabTest[];
    expect(reportCountsOf(tests)).toEqual({ pending: 2, ready: 1 });
  });

  it('is zero for nothing', () => {
    expect(reportCountsOf(undefined)).toEqual({ pending: 0, ready: 0 });
  });
});
