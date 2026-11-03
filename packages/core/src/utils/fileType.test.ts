import { fileKindOfType, fileNameForType, mediaTypeOf } from './fileType';

describe('mediaTypeOf', () => {
  it('drops parameters and case', () => {
    expect(mediaTypeOf('Image/JPEG; charset=binary')).toBe('image/jpeg');
    expect(mediaTypeOf(undefined)).toBe('');
  });
});

describe('fileKindOfType', () => {
  it('draws a PDF and the common images', () => {
    expect(fileKindOfType('application/pdf')).toBe('pdf');
    expect(fileKindOfType('image/jpeg')).toBe('image');
    expect(fileKindOfType('image/png')).toBe('image');
  });

  it('offers anything else as a download only', () => {
    expect(fileKindOfType('image/svg+xml')).toBe('other');
    expect(fileKindOfType('image/tiff')).toBe('other');
    expect(
      fileKindOfType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('other');
  });

  it('leaves it to the name when the server named no useful type', () => {
    expect(fileKindOfType('application/octet-stream')).toBeNull();
    expect(fileKindOfType('')).toBeNull();
    expect(fileKindOfType(null)).toBeNull();
  });
});

describe('fileNameForType', () => {
  it('renames a report for what it really is', () => {
    expect(fileNameForType('Report_CBC_BILL-2611-0084.pdf', 'image/jpeg')).toBe(
      'Report_CBC_BILL-2611-0084.jpg',
    );
    expect(fileNameForType('Report_XRay.pdf', 'image/png')).toBe('Report_XRay.png');
  });

  it('keeps the name of a PDF and of an unknown type', () => {
    expect(fileNameForType('Report_CBC.pdf', 'application/pdf')).toBe('Report_CBC.pdf');
    expect(fileNameForType('Report_CBC.pdf', 'application/octet-stream')).toBe('Report_CBC.pdf');
    expect(fileNameForType('Report_CBC.pdf', '')).toBe('Report_CBC.pdf');
  });

  it('adds the extension to a name without one', () => {
    expect(fileNameForType('Report', 'image/jpeg')).toBe('Report.jpg');
    expect(fileNameForType('', 'image/jpeg')).toBe('file.jpg');
  });
});
