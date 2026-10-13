import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientFindDoctorIndex from '../screens/patient/findDoctors/PatientFindDoctorIndex';
import DoctorDetails from '../screens/patient/findDoctors/DoctorDetails';
import CreateAppointment from '../screens/patient/findDoctors/CreateAppointment';
import ConfirmAppointment from '../screens/patient/findDoctors/ConfirmAppointment';
import BookingSuccessScreen from '../screens/patient/bookAppointment/BookingSuccessScreen';
import { DoctorFlowStackParamList } from './appointmentRoutes';

export type FindDoctorsStackParamList = DoctorFlowStackParamList & {
  PatientFindDoctorIndex: { specialty?: string } | undefined;
};

const Stack = createNativeStackNavigator<FindDoctorsStackParamList>();

/**
 * The Home tab. Find Doctors used to sit in the tab bare, which left the doctor
 * details and booking no screen to push onto — both had to happen in bottom
 * sheets. With a stack they are ordinary screens: list → details → appointment
 * → confirmation → success.
 */
export const FindDoctorsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PatientFindDoctorIndex" component={PatientFindDoctorIndex} />
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

export default FindDoctorsStackNavigator;
