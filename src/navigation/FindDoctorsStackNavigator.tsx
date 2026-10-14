import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientFindDoctorIndex from '../screens/patient/findDoctors/PatientFindDoctorIndex';
import DoctorDetails from '../screens/patient/findDoctors/DoctorDetails';
import BookingSuccessScreen from '../screens/patient/bookAppointment/BookingSuccessScreen';
export type FindDoctorsStackParamList = {
  PatientFindDoctorIndex: undefined;
  /** The doctor's `employeeId` — everything else about them is read by it. */
  DoctorDetails: { employeeId: number };
  /** Filled from the booking the API just confirmed. */
  BookingSuccess: {
    doctorName: string;
    doctorSpecialty: string;
    patientName: string;
    /** "2026-08-18". */
    date: string;
    /** The time actually booked, "14:09" — the server's when it chose one. */
    time: string;
    /** Where the visit takes place. */
    officeName: string;
    /** The patient's token for the day. */
    token: number;
    /** The label of the visit type booked, already translated. */
    consultationLabel: string;
    amount: number;
    /** "unpaid" | "partial" | "paid", as the API spells it. */
    paymentStatus: string;
  };
};

const Stack = createNativeStackNavigator<FindDoctorsStackParamList>();

/**
 * The Find Doctors tab: the directory, a doctor's page — where the visit is
 * booked — and the screen a placed booking lands on.
 */
export const FindDoctorsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PatientFindDoctorIndex" component={PatientFindDoctorIndex} />
    <Stack.Screen name="DoctorDetails" component={DoctorDetails} />
    {/* No swipe back: the booking is placed, and there is nothing behind it to
        return to. Android's Back is handled on the screen. */}
    <Stack.Screen
      name="BookingSuccess"
      component={BookingSuccessScreen}
      options={{ gestureEnabled: false }}
    />
  </Stack.Navigator>
);

export default FindDoctorsStackNavigator;
