import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { MedicalRecordRepository } from './MedicalRecordRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('MedicalRecordRepository.getRadiologyImages', () => {
  beforeEach(() => request.mockReset());

  it('asks for one test by its bill row and reads the viewer link', async () => {
    const viewerUrl = 'http://pacs.example/ohif/viewer?StudyInstanceUIDs=1.2.3&token=abc';
    request.mockResolvedValueOnce({ found: true, viewerUrl, message: null });

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: true,
      viewerUrl,
      message: '',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: ENDPOINTS.portalRadiologyImages,
        method: 'GET',
        params: { billRowId: 1234 },
      }),
    );
  });

  it("keeps the server's reason when the PACS has no images", async () => {
    request.mockResolvedValueOnce({
      found: false,
      viewerUrl: null,
      message: 'No images found in PACS for this accession no.',
    });

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: false,
      viewerUrl: '',
      message: 'No images found in PACS for this accession no.',
    });
  });

  it('reads an answer without its fields as not found', async () => {
    request.mockResolvedValueOnce({});

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: false,
      viewerUrl: '',
      message: '',
    });
  });

  it('fails on an answer that is not a record', async () => {
    request.mockResolvedValueOnce(null);
    await expect(MedicalRecordRepository.getRadiologyImages(1234)).rejects.toThrow();

    request.mockResolvedValueOnce([]);
    await expect(MedicalRecordRepository.getRadiologyImages(1234)).rejects.toThrow();
  });
});
