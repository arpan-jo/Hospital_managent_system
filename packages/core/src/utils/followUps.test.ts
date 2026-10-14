import { followUpBucket, toFollowUpStatus } from './followUps';

describe('toFollowUpStatus', () => {
  it('reads the stored values in any case', () => {
    expect(toFollowUpStatus(' Completed ')).toBe('completed');
    expect(toFollowUpStatus('CANCELLED')).toBe('cancelled');
    expect(toFollowUpStatus('pending')).toBe('pending');
  });

  it('reads anything else as pending', () => {
    expect(toFollowUpStatus('missed')).toBe('pending');
    expect(toFollowUpStatus(null)).toBe('pending');
  });
});

describe('followUpBucket', () => {
  const today = '2026-10-14';

  it('keeps a pending follow-up from today on as upcoming', () => {
    expect(followUpBucket({ status: 'pending', date: '2026-10-14' }, today)).toBe('upcoming');
    expect(followUpBucket({ status: 'pending', date: '2026-11-01' }, today)).toBe('upcoming');
  });

  it('moves a pending follow-up whose date has passed to overdue', () => {
    expect(followUpBucket({ status: 'pending', date: '2026-10-13' }, today)).toBe('overdue');
  });

  it('files completed and cancelled ones by status, whatever the date', () => {
    expect(followUpBucket({ status: 'completed', date: '2026-01-01' }, today)).toBe('completed');
    expect(followUpBucket({ status: 'cancelled', date: '2027-01-01' }, today)).toBe('cancelled');
  });
});
