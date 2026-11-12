import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExtractedLabReport, ExtractedPrescription, LabReportType, UploadedLabReport } from '@app/core';
import PatientReportIndex from '../screens/patient/reports/PatientReportIndex';
import VisitPrescriptionScreen from '../screens/patient/reports/VisitPrescriptionScreen';
import FileViewerScreen, { FileViewerParams } from '../screens/common/fileViewer/FileViewerScreen';
import RadiologyViewerScreen, { RadiologyViewerParams } from '../screens/patient/reports/RadiologyViewerScreen';
import UploadedLabReportScreen from '../screens/patient/reports/UploadedLabReportScreen';
import ReviewPrescriptionScreen from '../screens/patient/reports/review/ReviewPrescriptionScreen';
import ReviewLabReportScreen from '../screens/patient/reports/review/ReviewLabReportScreen';

/** A section of the Reports page something was just saved to — it opens and reads again. */
export type ReportsSavedTo = { section: 'prescriptions' | 'pathology' | 'radiology'; at: number };

/**
 * A bill's tests, asked for from the bill — the lab sections open searched by
 * its code, the portal's "Reports" link from a bill.
 */
export type ReportsForBill = { code: string; section: 'pathology' | 'radiology'; at: number };

export type ReportsStackParamList = {
  ReportsHome: { saved?: ReportsSavedTo; bill?: ReportsForBill } | undefined;
  /** One visit prescription, as the Reports page shows it. */
  VisitPrescription: { prescriptionId: number; title?: string };
  /** An uploaded document or a test report PDF, drawn in the app. */
  FileViewer: FileViewerParams;
  /** A radiology test's images from the PACS, drawn in the app. */
  RadiologyViewer: RadiologyViewerParams;
  /** A lab report the patient uploaded — it came whole with the list, so nothing is read again. */
  UploadedLabReport: { report: UploadedLabReport };
  /** The AI's read of an uploaded prescription, for the patient to check before it is saved. */
  ReviewPrescription: { documentId: number; registrationId: number; extraction: ExtractedPrescription };
  /** The AI's read of an uploaded lab report; `reportType` null — go by the read. */
  ReviewLabReport: {
    documentId: number;
    registrationId: number;
    extraction: ExtractedLabReport;
    reportType: LabReportType | null;
  };
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

/** The Reports tab — the list and everything opened from it, with its own back stack. */
export const ReportsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ReportsHome" component={PatientReportIndex} />
    <Stack.Screen name="VisitPrescription" component={VisitPrescriptionScreen} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} />
    <Stack.Screen name="RadiologyViewer" component={RadiologyViewerScreen} />
    <Stack.Screen name="UploadedLabReport" component={UploadedLabReportScreen} />
    <Stack.Screen name="ReviewPrescription" component={ReviewPrescriptionScreen} />
    <Stack.Screen name="ReviewLabReport" component={ReviewLabReportScreen} />
  </Stack.Navigator>
);

export default ReportsStackNavigator;
