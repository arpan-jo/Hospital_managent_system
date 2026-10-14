import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientProfileIndex from '../screens/patient/profile/PatientProfileIndex';
import ProfileEditScreen from '../screens/patient/profile/ProfileEditScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  /**
   * `returnToDoctorId`: the doctor whose page sent the patient here to finish
   * their profile first — once saved, they are taken back to it.
   */
  ProfileEdit: { returnToDoctorId?: number } | undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/** My Profile and its edit form share one back stack. */
export const ProfileStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={PatientProfileIndex} />
    <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
  </Stack.Navigator>
);

export default ProfileStackNavigator;
