import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientPrescriptionIndex from '../screens/patient/myPrescriptions/PatientPrescriptionIndex';
import FileViewerScreen, {
  FileViewerParams,
} from '../screens/common/fileViewer/FileViewerScreen';
import VisitPrescriptionScreen from '../screens/patient/reports/VisitPrescriptionScreen';
import { ReportsStackParamList } from './ReportsStackNavigator';

export type MyPrescriptionsStackParamList = {
  MyPrescriptionsList: undefined;
  /** An attached report or document, drawn in the app rather than handed out. */
  FileViewer: FileViewerParams;
  /** One prescription drawn as the app's own sheet — the same screen the Reports page opens. */
  VisitPrescription: ReportsStackParamList['VisitPrescription'];
};

const Stack = createNativeStackNavigator<MyPrescriptionsStackParamList>();

/** Nested inside the drawer's "My Prescriptions" screen — its own back stack, own headers. */
export const MyPrescriptionsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MyPrescriptionsList" component={PatientPrescriptionIndex} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} />
    <Stack.Screen name="VisitPrescription" component={VisitPrescriptionScreen} />
  </Stack.Navigator>
);

export default MyPrescriptionsStackNavigator;
