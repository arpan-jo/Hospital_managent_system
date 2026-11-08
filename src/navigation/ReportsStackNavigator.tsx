import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientReportIndex from '../screens/patient/reports/PatientReportIndex';
import VisitPrescriptionScreen from '../screens/patient/reports/VisitPrescriptionScreen';
import FileViewerScreen, { FileViewerParams } from '../screens/common/fileViewer/FileViewerScreen';
import RadiologyViewerScreen, { RadiologyViewerParams } from '../screens/patient/reports/RadiologyViewerScreen';

export type ReportsStackParamList = {
  ReportsHome: undefined;
  /** One visit prescription, as the Reports page shows it. */
  VisitPrescription: { prescriptionId: number; title?: string };
  /** An uploaded document or a test report PDF, drawn in the app. */
  FileViewer: FileViewerParams;
  /** A radiology test's images from the PACS, drawn in the app. */
  RadiologyViewer: RadiologyViewerParams;
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

/** The Reports tab — the list and everything opened from it, with its own back stack. */
export const ReportsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ReportsHome" component={PatientReportIndex} />
    <Stack.Screen name="VisitPrescription" component={VisitPrescriptionScreen} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} />
    <Stack.Screen name="RadiologyViewer" component={RadiologyViewerScreen} />
  </Stack.Navigator>
);

export default ReportsStackNavigator;
