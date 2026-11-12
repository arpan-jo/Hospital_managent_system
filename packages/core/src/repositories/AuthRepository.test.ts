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

describe('AuthRepository.login', () => {
  beforeEach(() => request.mockReset());

  it('gives a sign-in 30 seconds, not the client default', async () => {
    request.mockResolvedValueOnce({ token: 'jwt', role: 'Patient', userId: 18 });

    await AuthRepository.login({ email: ' a@b.com ' }, 'secret1');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: ENDPOINTS.login, method: 'POST', timeout: 30_000 }),
    );
  });
});

describe('AuthRepository — calls that send a code or a link', () => {
  beforeEach(() => request.mockReset());

  it('give the server 30 seconds, since it answers only once the SMS or email is out', async () => {
    request.mockResolvedValue({});

    await AuthRepository.sendOtp({ phone: '01711000000' }, 'Patient');
    await AuthRepository.sendResetOtp('01711000000');
    await AuthRepository.forgotPassword('a@b.com');

    for (const url of [ENDPOINTS.sendOtp, ENDPOINTS.sendResetOtp, ENDPOINTS.forgotPassword]) {
      expect(request).toHaveBeenCalledWith(expect.objectContaining({ url, timeout: 30_000 }));
    }
  });
});

describe('AuthRepository.login — an answer without a token', () => {
  beforeEach(() => request.mockReset());

  it("fails in the patient's words, not a developer's", async () => {
    request.mockResolvedValueOnce({ userId: 18, role: 'Patient' });

    await expect(AuthRepository.login({ email: 'a@b.com' }, 'secret1')).rejects.toThrow(
      "Sign-in didn't complete. Please try again.",
    );
  });
});
