// Stable across renders, as the real stores are — a new object each render would re-run the hook's effects for ever.
const mockStores = {
  authStore: { user: { userId: 1 } },
  profileStore: { patientProfileData: null, clear: jest.fn(), setPatientProfile: jest.fn() },
};
const mockT = (key: string) => key;
const mockMonths: string[] = [];

const mockRepos = {
  getDoctorById: jest.fn(),
  getConsultationDetail: jest.fn(),
  getAvailableSlots: jest.fn(),
  getProfile: jest.fn(),
};

jest.mock('@app/core', () => ({
  AppointmentBookingRepository: {
    getConsultationDetail: (...args: any[]) => mockRepos.getConsultationDetail(...args),
    getAvailableSlots: (...args: any[]) => mockRepos.getAvailableSlots(...args),
  },
  FindDoctorsRepository: { getDoctorById: (...args: any[]) => mockRepos.getDoctorById(...args) },
  PatientRepository: { getProfile: (...args: any[]) => mockRepos.getProfile(...args) },
  // The real date helpers, so the weekday and date rules run as they do in the app.
  fromISODate: jest.requireActual('../../../../packages/core/src/utils/format').fromISODate,
  toISODate: jest.requireActual('../../../../packages/core/src/utils/format').toISODate,
  formatLongDate: (value: string) => value,
  serverMessageOf: () => '',
  to12Hour: (value: string) => value,
  toBookingFailure: () => null,
  useStores: () => mockStores,
  withDoctorTitle: (value: string) => value,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('../../../hooks/useMonthNames', () => ({ useMonthNames: () => mockMonths }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useDoctorDetailsViewModel } from './useDoctorDetailsViewModel';

const doctor = { employeeId: 7, accountId: 1, branchId: 2, fullName: 'Dr. A' };
const slot = { slotId: 11, startTime: '09:00', endTime: '12:00', bookingCapacity: 10, availableSlots: 4, subSlots: [] };

let viewModel: ReturnType<typeof useDoctorDetailsViewModel>;
const Probe = () => {
  viewModel = useDoctorDetailsViewModel(7);
  return null;
};

const settle = async (run?: () => unknown) => {
  await act(async () => {
    await run?.();
  });
};

describe('useDoctorDetailsViewModel — slots', () => {
  beforeEach(async () => {
    Object.values(mockRepos).forEach(fn => fn.mockReset());
    mockRepos.getDoctorById.mockImplementation(async () => ({ ...doctor }));
    mockRepos.getConsultationDetail.mockResolvedValue(null);
    mockRepos.getProfile.mockResolvedValue({ registrationId: 5, fullName: 'Al Amin' });
    mockRepos.getAvailableSlots.mockResolvedValue([slot]);
    await settle(() => TestRenderer.create(<Probe />));
    await settle(() => viewModel.pickDate('2026-11-20'));
  });

  it('reads the chosen day', () => {
    expect(viewModel.slots).toEqual([slot]);
  });

  it('keeps the slots shown when a re-read of the same day fails, as the portal does', async () => {
    mockRepos.getAvailableSlots.mockRejectedValueOnce(new Error('offline'));

    // A review refreshes the doctor, which reads the same day's slots again.
    await settle(() => viewModel.refreshDoctor());

    expect(mockRepos.getAvailableSlots).toHaveBeenCalledTimes(2);
    expect(viewModel.slots).toEqual([slot]);
  });

  it("empties the list when another day's read fails — one day's slots never stand in for another's", async () => {
    mockRepos.getAvailableSlots.mockRejectedValueOnce(new Error('offline'));

    await settle(() => viewModel.pickDate('2026-11-21'));

    expect(viewModel.slots).toEqual([]);
  });
});
