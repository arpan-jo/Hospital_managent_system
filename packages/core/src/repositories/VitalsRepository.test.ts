import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { VitalsRepository } from './VitalsRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('VitalsRepository.getVitals', () => {
  beforeEach(() => request.mockReset());

  it('reads every sitting, in the order the backend sends them', async () => {
    request.mockResolvedValueOnce([
      {
        id: 14,
        appointmentId: 41,
        recordedAt: '2026-10-02T09:40:00',
        bpSys: 120,
        bpDia: 80,
        pulse: 72,
        tempCelsius: 36.8,
        spo2: 98,
        respRate: 16,
        heightCm: 170,
        weightKg: 68.5,
        bmi: 23.7,
        doctorName: 'Dr. Nabid Alam',
        patientRegistrationId: 2367,
        patientName: 'Al Amin',
        patientCode: 'P-2367',
      },
      {
        id: -77,
        appointmentId: 0,
        recordedAt: '2026-11-01T00:00:00',
        bpSys: 130,
        bpDia: null,
        pulse: null,
        tempCelsius: null,
        spo2: null,
        respRate: null,
        heightCm: null,
        weightKg: null,
        bmi: null,
        doctorName: null,
        source: 'PatientUpload',
        patientRegistrationId: 2367,
        patientName: 'Al Amin',
        patientCode: 'P-2367',
      },
    ]);

    const vitals = await VitalsRepository.getVitals();

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: ENDPOINTS.portalVitals, method: 'GET' }));
    expect(vitals).toEqual([
      {
        id: 14,
        appointmentId: 41,
        recordedAt: '2026-10-02T09:40:00',
        bpSys: 120,
        bpDia: 80,
        pulse: 72,
        tempCelsius: 36.8,
        spo2: 98,
        respRate: 16,
        heightCm: 170,
        weightKg: 68.5,
        bmi: 23.7,
        doctorName: 'Dr. Nabid Alam',
        isUploaded: false,
        patientRegistrationId: 2367,
        patientName: 'Al Amin',
        patientCode: 'P-2367',
      },
      {
        id: -77,
        appointmentId: 0,
        recordedAt: '2026-11-01T00:00:00',
        bpSys: 130,
        bpDia: null,
        pulse: null,
        tempCelsius: null,
        spo2: null,
        respRate: null,
        heightCm: null,
        weightKg: null,
        bmi: null,
        doctorName: '',
        isUploaded: true,
        patientRegistrationId: 2367,
        patientName: 'Al Amin',
        patientCode: 'P-2367',
      },
    ]);
  });

  it('keeps a sitting with nothing taken, as the portal does', async () => {
    request.mockResolvedValueOnce([{ id: 3, recordedAt: '2026-11-02T10:00:00' }]);

    const [record] = await VitalsRepository.getVitals();

    expect(record.bpSys).toBeNull();
    expect(record.weightKg).toBeNull();
    expect(record.isUploaded).toBe(false);
  });

  it('reads junk readings as not taken', async () => {
    request.mockResolvedValueOnce([{ id: 3, pulse: 'abc', spo2: '', tempCelsius: '37.1' }]);

    const [record] = await VitalsRepository.getVitals();

    expect(record.pulse).toBeNull();
    expect(record.spo2).toBeNull();
    expect(record.tempCelsius).toBe(37.1);
  });

  it('treats a non-list answer as a failure', async () => {
    request.mockResolvedValueOnce(null);

    await expect(VitalsRepository.getVitals()).rejects.toThrow('Unexpected vitals response');
  });
});
