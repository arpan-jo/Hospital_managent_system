import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientReportIndex from '../screens/patient/reports/PatientReportIndex';
import PathologyReportScreen from '../screens/patient/reports/PathologyReportScreen';
import RadiologyReportScreen from '../screens/patient/reports/RadiologyReportScreen';
import VisitPrescriptionScreen from '../screens/patient/reports/VisitPrescriptionScreen';
import FileViewerScreen, { FileViewerParams } from '../screens/common/fileViewer/FileViewerScreen';

export type ReportsStackParamList = {
  ReportsHome: undefined;
  /** One delivered lab report, read in full by its bill row; `title` shows while it loads. */
  PathologyReport: { billRowId: number; title?: string };
  /** One delivered imaging report. */
  RadiologyReport: { billRowId: number; title?: string };
  /** One visit prescription, as the Reports page shows it. */
  VisitPrescription: { prescriptionId: number; title?: string };
  /** An uploaded document, drawn in the app. */
  FileViewer: FileViewerParams;
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

/** The Reports tab — the list and everything opened from it, with its own back stack. */
export const ReportsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ReportsHome" component={PatientReportIndex} />
    <Stack.Screen name="PathologyReport" component={PathologyReportScreen} />
    <Stack.Screen name="RadiologyReport" component={RadiologyReportScreen} />
    <Stack.Screen name="VisitPrescription" component={VisitPrescriptionScreen} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} />
  </Stack.Navigator>
);

export default ReportsStackNavigator;
