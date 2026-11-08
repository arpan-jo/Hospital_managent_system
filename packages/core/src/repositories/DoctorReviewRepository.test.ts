import apiRequest from '../network/apiRequest';
import { DoctorReviewRepository } from './DoctorReviewRepository';
import { toPortalDoctor } from './FindDoctorsRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('DoctorReviewRepository.getReviews', () => {
  beforeEach(() => request.mockReset());

  it("reads the doctor's stars, the reviews and whether the account may rate", async () => {
    request.mockResolvedValueOnce({
      doctorEmployeeId: 7,
      reviewCount: 2,
      averageRating: 4.5,
      canReview: true,
      reviews: [
        {
          reviewId: 3,
          doctorEmployeeId: 7,
          rating: 5,
          comment: ' Very kind. ',
          createdAt: '2026-11-07T10:00:00',
          patientName: 'Rahim U.',
          isMine: false,
        },
        { reviewId: 4, doctorEmployeeId: 7, rating: 4, comment: null, createdAt: '', patientName: null, isMine: true },
      ],
    });

    const summary = await DoctorReviewRepository.getReviews(7);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/portal/doctors/GetReviews', method: 'GET', params: { employeeId: 7 } }),
    );
    expect(summary).toEqual({
      doctorEmployeeId: 7,
      reviewCount: 2,
      averageRating: 4.5,
      canReview: true,
      reviews: [
        {
          reviewId: 3,
          doctorEmployeeId: 7,
          rating: 5,
          comment: 'Very kind.',
          createdAt: '2026-11-07T10:00:00',
          patientName: 'Rahim U.',
          isMine: false,
        },
        { reviewId: 4, doctorEmployeeId: 7, rating: 4, comment: '', createdAt: '', patientName: '', isMine: true },
      ],
    });
  });

  it('reads a doctor nobody has rated', async () => {
    request.mockResolvedValueOnce({ reviewCount: 0, averageRating: null, canReview: false, reviews: null });

    await expect(DoctorReviewRepository.getReviews(9)).resolves.toEqual({
      doctorEmployeeId: 9,
      reviewCount: 0,
      averageRating: null,
      canReview: false,
      reviews: [],
    });
  });

  it('treats a non-object answer as a failure', async () => {
    request.mockResolvedValueOnce([]);
    await expect(DoctorReviewRepository.getReviews(9)).rejects.toThrow('Unexpected reviews response');
  });
});

describe('DoctorReviewRepository.addReview', () => {
  beforeEach(() => request.mockReset());

  it('sends the rating the way the portal does', async () => {
    request.mockResolvedValueOnce({ reviewId: 11, doctorEmployeeId: 7, rating: 4, comment: 'Good', isMine: true });

    const review = await DoctorReviewRepository.addReview({
      doctorEmployeeId: 7,
      patientRegistrationId: 2367,
      appointmentId: 41,
      rating: 4,
      comment: '  Good  ',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/hms/portal/doctors/AddReview',
        method: 'POST',
        data: { doctorEmployeeId: 7, patientRegistrationId: 2367, appointmentId: 41, rating: 4, comment: 'Good' },
      }),
    );
    expect(review.reviewId).toBe(11);
    expect(review.isMine).toBe(true);
  });

  it('sends no visit and no comment when there are none', async () => {
    request.mockResolvedValueOnce({});

    await DoctorReviewRepository.addReview({ doctorEmployeeId: 7, patientRegistrationId: 2367, rating: 5, comment: '   ' });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { doctorEmployeeId: 7, patientRegistrationId: 2367, appointmentId: null, rating: 5, comment: null },
      }),
    );
  });
});

describe('toPortalDoctor ratings', () => {
  it('reads the stars, and none on an older backend', () => {
    expect(toPortalDoctor({ employeeId: 7, reviewCount: 12, averageRating: 4.25 })).toMatchObject({
      reviewCount: 12,
      averageRating: 4.25,
    });
    expect(toPortalDoctor({ employeeId: 7 })).toMatchObject({ reviewCount: 0, averageRating: null });
  });
});
