import { DEFAULT_OTP_EXPIRY_SECONDS, otpDeadline, readOtpBox, secondsUntil } from './otpUtils';

describe('otpDeadline / secondsUntil', () => {
  const now = 1_000_000;

  it('counts down from when the code was sent, so time away from the app is counted', () => {
    const deadline = otpDeadline(300, now);
    expect(secondsUntil(deadline, now)).toBe(300);
    // Two minutes away reading the SMS — the timer shows what is really left.
    expect(secondsUntil(deadline, now + 120_000)).toBe(180);
    // Away past the expiry: 0, so Resend opens at once.
    expect(secondsUntil(deadline, now + 400_000)).toBe(0);
  });

  it('rounds a part second up, so 00:00 shows only once the code has run out', () => {
    expect(secondsUntil(otpDeadline(300, now), now + 299_500)).toBe(1);
  });

  it('falls back to the default expiry when the answer carried none', () => {
    expect(secondsUntil(otpDeadline(undefined, now), now)).toBe(DEFAULT_OTP_EXPIRY_SECONDS);
    expect(secondsUntil(otpDeadline(null, now), now)).toBe(DEFAULT_OTP_EXPIRY_SECONDS);
    expect(secondsUntil(otpDeadline(0, now), now)).toBe(DEFAULT_OTP_EXPIRY_SECONDS);
    expect(secondsUntil(otpDeadline(-5, now), now)).toBe(DEFAULT_OTP_EXPIRY_SECONDS);
  });

  it('never goes below 0, and reads a bad deadline as run out', () => {
    expect(secondsUntil(now - 5_000, now)).toBe(0);
    expect(secondsUntil(NaN, now)).toBe(0);
  });
});

describe('readOtpBox', () => {
  it('reads typing as the box’s new digit', () => {
    expect(readOtpBox('', '5', 6)).toEqual({ digit: '5', pasted: null });
    // A box that held 3, typed over with 5.
    expect(readOtpBox('3', '35', 6)).toEqual({ digit: '5', pasted: null });
    // Cleared.
    expect(readOtpBox('3', '', 6)).toEqual({ digit: '', pasted: null });
    expect(readOtpBox('', 'a', 6)).toEqual({ digit: '', pasted: null });
  });

  it('reads a pasted code as the first six digits, as the portal does', () => {
    expect(readOtpBox('', '123456', 6)).toEqual({ digit: null, pasted: ['1', '2', '3', '4', '5', '6'] });
    // Pasted into a box that already held 3: its own digit is in front.
    expect(readOtpBox('3', '3123456', 6)).toEqual({ digit: null, pasted: ['1', '2', '3', '4', '5', '6'] });
  });

  it('reads the whole SMS pasted in as its code, not the last six digits', () => {
    const sms = 'Your code is 123456. It expires in 5 minutes.';
    expect(readOtpBox('', sms, 6)?.pasted?.join('')).toBe('123456');
    expect(readOtpBox('7', `7${sms}`, 6)?.pasted?.join('')).toBe('123456');
  });

  it('fills from the first box with a short paste, as the portal does', () => {
    expect(readOtpBox('', '1234', 6)).toEqual({ digit: null, pasted: ['1', '2', '3', '4'] });
  });
});
