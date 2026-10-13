import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientProfileIndex from '../screens/patient/profile/PatientProfileIndex';
import ProfileEditScreen from '../screens/patient/profile/ProfileEditScreen';
import AddFamilyMemberScreen from '../screens/patient/profile/AddFamilyMemberScreen';
import MemberRecordsScreen from '../screens/patient/profile/MemberRecordsScreen';
import { ProfileTab } from '../screens/patient/profile/useProfileViewModel';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: undefined;
  /** `patientCode` set means edit that relative; omitted means add a new one. */
  AddFamilyMember: { patientCode?: string } | undefined;
  /**
   * One relative's medical history and allergies. `section` is the link that
   * was tapped on their family card, so the screen opens on that tab.
   */
  MemberRecords: {
    patientCode: string;
    memberName?: string;
    section?: Extract<ProfileTab, 'medical' | 'allergies'>;
  };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/** Profile + its pushed screens (edit, add family member) share one back stack. */
export const ProfileStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={PatientProfileIndex} />
    <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
    <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} />
    <Stack.Screen name="MemberRecords" component={MemberRecordsScreen} />
  </Stack.Navigator>
);

export default ProfileStackNavigator;
