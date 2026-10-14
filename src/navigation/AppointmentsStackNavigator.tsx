import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientAppointmentIndex from '../screens/patient/appointments/PatientAppointmentIndex';
import AppointmentDetailsScreen from '../screens/patient/appointments/AppointmentDetailsScreen';

export type AppointmentsStackParamList = {
  AppointmentsList: undefined;
  /** Reached from a card's View Details — the screen re-reads the row by id. */
  AppointmentDetails: { appointmentId: string };
};

const Stack = createNativeStackNavigator<AppointmentsStackParamList>();

/** The Appointments tab — its own back stack, own headers. */
export const AppointmentsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AppointmentsList" component={PatientAppointmentIndex} />
    <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
  </Stack.Navigator>
);

export default AppointmentsStackNavigator;
