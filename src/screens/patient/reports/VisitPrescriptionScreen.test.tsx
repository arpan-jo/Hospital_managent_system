// The prescription screen drawn from GetPrescriptionPrintData alone — with the
// live answer, with nothing, and with data of the wrong shape: it must draw
// what it can and never throw.
const mockGetPrintData = jest.fn();
let mockRouteParams: Record<string, unknown> = {};

jest.mock('@app/core', () => ({
  ...jest.requireActual('../../../../packages/core/src/utils/format'),
  serverMessageOf: jest.requireActual('../../../../packages/core/src/network/serverMessage').serverMessageOf,
  MedicalRecordRepository: {
    getPrescriptionPrintData: (...args: unknown[]) => mockGetPrintData(...args),
  },
}));
// The real mapper is used; its module's network layer (and the stores behind it) is not.
jest.mock('../../../../packages/core/src/network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@app/ui', () => ({
  AppLightTheme: jest.requireActual('../../../../packages/ui/src/theme').AppLightTheme,
  fontFamilies: jest.requireActual('../../../../packages/ui/src/theme/typography').fontFamilies,
}));
jest.mock('react-i18next', () => ({
  // The real repository brings the app's i18n setup along, which registers this plugin.
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string, options?: { count?: number }) => (options?.count != null ? `${key}:${options.count}` : key) }),
}));
// The package is ESM jest does not transform; the theme only needs its two themes to spread.
jest.mock('@react-navigation/native', () => ({
  DefaultTheme: { dark: false, colors: {}, fonts: {} },
  DarkTheme: { dark: true, colors: {}, fonts: {} },
  useNavigation: () => ({}),
  DrawerActions: {},
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('./PrescriptionZoomModal', () => () => null);
jest.mock('./RecordDetail', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ...jest.requireActual('./RecordDetail'),
    RecordDetailScreen: ({ children, headerRight }: any) => ReactActual.createElement(View, null, headerRight, children),
    DetailNote: ({ children }: any) => ReactActual.createElement(View, null, children),
  };
});

import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { toPrescriptionPrintData } from '../../../../packages/core/src/repositories/MedicalRecordRepository';
import VisitPrescriptionScreen from './VisitPrescriptionScreen';

/** The live answer for prescription 2315 (trimmed to what the sheet reads). */
const liveAnswer = {
  prescription: {
    id: 2315,
    prescriptionCode: 'PRS-20261017-000000001',
    patientCode: 'REG-2026-0107',
    patientName: 'Al Amin',
    gender: 'Male',
    dateOfBirth: '1997-03-12',
    mobile: '01711000000',
    departmentName: 'Gynaecology & Obstetrics',
    doctorName: 'Khairul Bashar',
    createdAt: '2026-10-17T11:27:10.59',
    sourceHospitalName: null,
    sourceDate: null,
  },
  isPatientUpload: false,
  patient: { patientName: 'Al Amin', mobile: '01711000000', age: '29', gender: 'Male', address: '', patientId: 'REG-2026-0107' },
  hospital: { logoUrl: null, name: 'Marie Stopes Bangladesh', address: 'HQ', officeName: 'MSB HQ' },
  layout: {
    hospitalInfo: { enabled: true, content: '<p><b>Akij Mediplex Limited</b></p><p>House No, 02, Road 05 Pallabi Rd, Dhaka 1216</p>' },
    header: {
      enabled: true,
      contents: ['<p>Dr. Tanjim Akter Tanha</p><p>MBBS, FCPS, MA, FRCPS, DGO</p>', '<p>ডা. তানজিম আক্তার তানহা</p>', ''],
    },
    footer: { enabled: true, contents: ['<p><b>আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।</b></p>', '', ''] },
    notice: { enabled: true, text: 'রোগী দেখার সময়: সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত' },
  },
  leftSections: [{ key: 'physicalExamination', label: 'Physical Examination' }, { key: 'diagnosis', label: 'Diagnosis' }],
  rightSections: [{ key: 'rx', label: 'Rx' }, { key: 'followUp', label: 'Follow-up' }, { key: 'advice', label: 'Advice' }],
  sectionData: {
    rx: [
      { type: 'Tablet', generic: 'Amiodarone Hydrochloride', brand: 'Pacet [100 mg]', route: 'Oral', dose: '০+০+১', durationValue: '2', durationUnit: 'Days', isContinue: false, isMixed: false, note: 'খাবারের আগে' },
      { type: 'Suppository', generic: 'Paracetamol', brand: 'Napa [250 mg]', route: 'Oral', dose: '১+০+০', durationValue: '2', durationUnit: 'Days', isContinue: false, isMixed: false, note: 'খাবারের আগে' },
    ],
    physicalExamination: {
      __vitals: { 'Pulse (R)': '33', 'BP Sys': '55', 'Height Unit': 'CM', 'Height (cm)': '66' },
      __groups: [{ id: '__vitals', name: 'Vitals' }],
    },
    advice: [{ name: 'Drink plenty of water' }],
  },
  signatoryHtml: '',
  signatureImageId: '',
};

let renderer: ReactTestRenderer | undefined;

/** The barcode's box, found by the code it names for screen readers. */
const barcodeBox = () =>
  renderer?.root.findAll(
    node => String(node.type) === 'View' && String(node.props?.accessibilityLabel ?? '').startsWith('reports.pad.rxNo '),
  )[0];

/** Every text the screen wrote, one entry a Text. */
const textNodes = () =>
  (renderer?.root.findAll(node => String(node.type) === 'Text') ?? []).map(node =>
    (node.children ?? []).filter(child => typeof child === 'string').join(''),
  );

/** Everything the screen wrote, as one string. */
const drawnText = () => JSON.stringify(renderer?.toJSON() ?? null);

const open = async (answer: () => Promise<unknown>) => {
  mockGetPrintData.mockImplementation(answer);
  await act(async () => {
    renderer = TestRenderer.create(<VisitPrescriptionScreen />);
  });
  await act(async () => {
    await Promise.resolve();
  });
};

describe('VisitPrescriptionScreen — from GetPrescriptionPrintData alone', () => {
  beforeEach(() => {
    mockGetPrintData.mockReset();
    mockRouteParams = { prescriptionId: 2315, title: 'PRS-20261017-000000001', visitType: 'opd' };
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it('asks for the clicked prescription and draws the sheet from the one answer', async () => {
    await open(async () => toPrescriptionPrintData(liveAnswer));

    expect(mockGetPrintData).toHaveBeenCalledTimes(1);
    expect(mockGetPrintData).toHaveBeenCalledWith(2315);
    const text = drawnText();
    // Letterhead from the page layout's header, with the hours.
    expect(text).toContain('Dr. Tanjim Akter Tanha');
    expect(text).toContain('MBBS, FCPS, MA, FRCPS, DGO');
    expect(text).toContain('রোগী দেখার সময়');
    // The patient.
    expect(text).toContain('Al Amin');
    expect(text).toContain('01711000000');
    expect(text).toContain('REG-2026-0107');
    // Vitals and medicines out of the raw sectionData.
    expect(text).toContain('Pulse (R)');
    expect(text).toContain('Tab. Pacet [100 mg]');
    expect(text).toContain('Supp. Napa [250 mg]');
    expect(text).toContain('০ + ০ + ১');
    // The foot: the hospital's lines and the number.
    expect(text).toContain('Akij Mediplex Limited');
    expect(text).toContain('আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।');
    // The number as a barcode, not as text.
    expect(barcodeBox()?.props?.accessibilityLabel).toBe('reports.pad.rxNo PRS-20261017-000000001');
    expect(textNodes().some(line => line.includes('PRS-20261017-000000001'))).toBe(false);
    act(() => {
      barcodeBox()?.props?.onLayout?.({ nativeEvent: { layout: { width: 320 } } });
    });
    // Once it knows its width it draws the bars, inside its own box.
    const bars = barcodeBox()?.findAll(
      node => String(node.type) === 'View' && StyleSheet.flatten(node.props?.style)?.flexDirection === 'row',
    )[0];
    expect((bars?.children ?? []).length).toBeGreaterThan(100);
    // The tenant's account name is not the hospital the sheet prints.
    expect(text).not.toContain('Marie Stopes');
  });

  it('draws an empty answer without throwing', async () => {
    await open(async () => toPrescriptionPrintData({}));
    expect(renderer?.toJSON()).toBeTruthy();
    expect(drawnText()).toContain('reports.noPrescriptionDetails');
  });

  it('draws an answer of the wrong shape without throwing', async () => {
    await open(async () =>
      toPrescriptionPrintData({
        prescription: { prescriptionCode: { a: 1 }, createdAt: 'not a date', doctorName: null, sectionDataJson: '{bad' },
        patient: { patientName: 5, age: 'abc', gender: {} },
        layout: { header: { contents: [null, ''] }, footer: { contents: 'x' }, notice: { text: {} } },
        leftSections: [{ key: 'diagnosis' }],
        rightSections: [{ key: 'advice' }],
        sectionData: {
          rx: [null, { brand: 7 }, { brand: 'Ok 5 mg', dose: 1, durationValue: 2, multiDose: 'nope' }],
          physicalExamination: { __vitals: null, __groups: 'x' },
          diagnosis: 'just text',
          advice: [{}, null, { name: '' }],
        },
        signatoryHtml: ['x'],
      }),
    );
    expect(renderer?.toJSON()).toBeTruthy();
    expect(drawnText()).toContain('Ok 5 mg');
    expect(drawnText()).not.toContain('[object Object]');
    // A code that is not one has no barcode — and no "[object Object]" in bars.
    expect(barcodeBox()).toBeUndefined();
  });

  it('draws nothing of the sheet when the call fails (a 404), and does not throw', async () => {
    await open(async () => {
      throw Object.assign(new Error('Not Found'), { status: 404 });
    });
    expect(renderer?.toJSON()).toBeTruthy();
    expect(drawnText()).not.toContain('reports.pad.name');
  });

  it('does not throw with no route params at all', async () => {
    mockRouteParams = undefined as unknown as Record<string, unknown>;
    await open(async () => toPrescriptionPrintData(liveAnswer));
    expect(renderer?.toJSON()).toBeTruthy();
  });
});
