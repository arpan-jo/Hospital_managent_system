import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientAppointmentIndex from '../screens/patient/appointments/PatientAppointmentIndex';
import AppointmentDetailsScreen from '../screens/patient/appointments/AppointmentDetailsScreen';
import DoctorDetails from '../screens/patient/findDoctors/DoctorDetails';
import CreateAppointment from '../screens/patient/findDoctors/CreateAppointment';
import ConfirmAppointment from '../screens/patient/findDoctors/ConfirmAppointment';
import BookingSuccessScreen from '../screens/patient/bookAppointment/BookingSuccessScreen';
import { DoctorFlowStackParamList } from './appointmentRoutes';

export type AppointmentsStackParamList = DoctorFlowStackParamList & {
  AppointmentsList: undefined;
  /** Reached from a card's View Details — the screen re-reads the row by id. */
  AppointmentDetails: { appointmentId: string };
};

const Stack = createNativeStackNavigator<AppointmentsStackParamList>();

/**
 * The Activity tab — its own back stack, own headers. It mounts the same doctor
 * and booking screens as the Home tab because rebooking with a doctor often
 * starts from an existing appointment rather than from Find Doctors.
 */
export const AppointmentsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AppointmentsList" component={PatientAppointmentIndex} />
    <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
    <Stack.Screen name="DoctorDetails" component={DoctorDetails} />
    <Stack.Screen name="CreateAppointment" component={CreateAppointment} />
    <Stack.Screen name="ConfirmAppointment" component={ConfirmAppointment} />
    {/* No swipe back: behind it is the confirm screen, and confirming again
        would book a second appointment. Android's Back is handled on the screen. */}
    <Stack.Screen
      name="BookingSuccess"
      component={BookingSuccessScreen}
      options={{ gestureEnabled: false }}
    />
  </Stack.Navigator>
);

export default AppointmentsStackNavigator;
