import apiRequest from '../network/apiRequest';
import { PatientPrescriptionRepository, toPortalPrescription } from './PatientPrescriptionRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

describe('toPortalPrescription', () => {
  it('reads a doctor-written prescription as before', () => {
    const rx = toPortalPrescription({
      prescriptionId: 7,
      prescriptionCode: 'RX-2611-0001',
      doctorName: 'Nabid Alam',
      visitType: 'OPD',
      source: 'Doctor',
    });
    expect(rx.isUploaded).toBe(false);
    expect(rx.code).toBe('RX-2611-0001');
    expect(rx.visitType).toBe('opd');
    expect(rx.sourceHospitalName).toBe('');
    expect(rx.sourceDate).toBe('');
  });

  it('marks an uploaded one and keeps where and when it was written', () => {
    const rx = toPortalPrescription({
      prescriptionId: 9,
      prescriptionCode: '',
      doctorName: null,
      visitType: 'opd',
      source: 'PatientUpload',
      sourceHospitalName: ' Popular Diagnostic ',
      sourceDate: '2026-10-28T00:00:00',
    });
    expect(rx.isUploaded).toBe(true);
    expect(rx.code).toBe('');
    expect(rx.doctorName).toBe('');
    expect(rx.sourceHospitalName).toBe('Popular Diagnostic');
    expect(rx.sourceDate).toBe('2026-10-28T00:00:00');
  });

  it('reads an older backend, with no source at all, as doctor-written', () => {
    expect(toPortalPrescription({ prescriptionId: 1 }).isUploaded).toBe(false);
    expect(toPortalPrescription(null).isUploaded).toBe(false);
    expect(toPortalPrescription({ source: 'patientupload' }).isUploaded).toBe(true);
  });
});

describe('PatientPrescriptionRepository.removeUploadedPrescription', () => {
  const request = apiRequest as jest.MockedFunction<typeof apiRequest>;
  beforeEach(() => request.mockReset());

  it('deletes the upload by its prescription id', async () => {
    request.mockResolvedValueOnce(undefined);

    await PatientPrescriptionRepository.removeUploadedPrescription(812);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/patient/documents/prescriptions/812', method: 'DELETE' }),
    );
  });

  it('passes a failure on to the caller', async () => {
    request.mockRejectedValueOnce(new Error('Request failed with status code 404'));

    await expect(PatientPrescriptionRepository.removeUploadedPrescription(9)).rejects.toThrow('404');
  });
});
