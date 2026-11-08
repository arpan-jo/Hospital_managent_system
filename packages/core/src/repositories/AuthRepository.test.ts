import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { AuthRepository } from './AuthRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('AuthRepository.linkPhone', () => {
  beforeEach(() => request.mockReset());

  it('sends the number in its local form and the code trimmed', async () => {
    request.mockResolvedValueOnce({ message: 'Mobile number verified.', claimedRegistrations: 2 });

    await expect(AuthRepository.linkPhone('+880 1711-000000', ' 123456 ')).resolves.toEqual({
      message: 'Mobile number verified.',
      claimedRegistrations: 2,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: ENDPOINTS.linkPhone,
        method: 'POST',
        data: { phone: '01711000000', code: '123456' },
      }),
    );
  });

  it('reads a bare or odd answer as no message and no records', async () => {
    request.mockResolvedValueOnce(null);
    await expect(AuthRepository.linkPhone('01711000000', '123456')).resolves.toEqual({
      message: '',
      claimedRegistrations: 0,
    });

    request.mockResolvedValueOnce({ message: 42, claimedRegistrations: 'many' });
    await expect(AuthRepository.linkPhone('01711000000', '123456')).resolves.toEqual({
      message: '',
      claimedRegistrations: 0,
    });

    request.mockResolvedValueOnce({ claimedRegistrations: -3 });
    await expect(AuthRepository.linkPhone('01711000000', '123456')).resolves.toEqual({
      message: '',
      claimedRegistrations: 0,
    });
  });

  it('passes a refusal on to the caller', async () => {
    const conflict = Object.assign(new Error('Conflict'), {
      status: 409,
      data: { message: 'An account with this mobile number already exists.' },
    });
    request.mockRejectedValueOnce(conflict);

    await expect(AuthRepository.linkPhone('01711000000', '123456')).rejects.toBe(conflict);
  });
});
