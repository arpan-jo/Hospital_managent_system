import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { PatientProfileForm, PatientRepository } from './PatientRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./FileRepository', () => ({ __esModule: true, default: { upload: jest.fn() } }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

const form = (fields: Partial<PatientProfileForm>): PatientProfileForm => ({
  identificationType: 'General ID',
  identificationNumber: '',
  fullName: 'Al Amin',
  dateOfBirth: '1995-01-01',
  phone: '01712345678',
  bloodType: 'B+',
  gender: 'Male',
  division: '',
  district: '',
  upazila: '',
  address: '',
  coName: '',
  coRelationship: '',
  coMobileNumber: '',
  emergencyContact: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  emergencyAddress: '',
  occupation: '',
  nationality: '',
  identityMark: '',
  religion: '',
  email: '',
  ...fields,
});

/** What the first save call sent. */
const sentData = () => (request.mock.calls?.[0]?.[0] as any)?.data;

describe('PatientRepository.saveProfile — mobile numbers', () => {
  beforeEach(() => {
    request.mockReset();
    // The save, then the profile read back.
    request.mockResolvedValueOnce({}).mockResolvedValueOnce({ fullName: 'Al Amin' });
  });

  it('sends the mobile in its local 01XXXXXXXXX form, however it was typed', async () => {
    await PatientRepository.saveProfile(form({ phone: '+880 1712-345678', emergencyPhone: '00880 1812 345678' }));

    expect(request.mock.calls?.[0]?.[0]).toMatchObject({ url: ENDPOINTS.patientRegistration, method: 'POST' });
    expect(sentData()).toMatchObject({ mobileNumber: '01712345678', emergencyMobile: '01812345678' });
  });

  it('leaves a local number as it is, and an empty emergency number out', async () => {
    await PatientRepository.saveProfile(form({ phone: ' 01712345678 ', emergencyPhone: '  ' }));

    expect(sentData()).toMatchObject({ mobileNumber: '01712345678', emergencyMobile: null });
  });
});
