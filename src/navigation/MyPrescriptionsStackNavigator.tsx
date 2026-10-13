import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientPrescriptionIndex from '../screens/patient/myPrescriptions/PatientPrescriptionIndex';
import TodaysMedicinesScreen from '../screens/patient/myPrescriptions/TodaysMedicinesScreen';
import PrescriptionPreviewScreen from '../screens/patient/myPrescriptions/PrescriptionPreviewScreen';
import FileViewerScreen, {
  FileViewerParams,
} from '../screens/common/fileViewer/FileViewerScreen';

export type MyPrescriptionsStackParamList = {
  MyPrescriptionsList: undefined;
  TodaysMedicines: undefined;
  PrescriptionPreview: { prescriptionId: string };
  /** An attached report or document, drawn in the app rather than handed out. */
  FileViewer: FileViewerParams;
};

const Stack = createNativeStackNavigator<MyPrescriptionsStackParamList>();

/** Nested inside the drawer's "My Prescriptions" screen — its own back stack, own headers. */
export const MyPrescriptionsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MyPrescriptionsList" component={PatientPrescriptionIndex} />
    <Stack.Screen name="TodaysMedicines" component={TodaysMedicinesScreen} />
    <Stack.Screen name="PrescriptionPreview" component={PrescriptionPreviewScreen} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} />
  </Stack.Navigator>
);

export default MyPrescriptionsStackNavigator;
