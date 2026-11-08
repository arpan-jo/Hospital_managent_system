import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessagesListScreen from '../screens/patient/messages/MessagesListScreen';
import MessageThreadScreen from '../screens/patient/messages/MessageThreadScreen';

export type MessagesStackParamList = {
  MessagesList: undefined;
  /**
   * One conversation — a registration with a doctor. The doctor's and the
   * patient's names come along so the header shows before the thread is read.
   */
  MessageThread: {
    patientRegistrationId: number;
    doctorEmployeeId: number;
    doctorName?: string;
    doctorSpecialty?: string;
    doctorPhotoUrl?: string;
    patientName?: string;
  };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

/** Messages — the conversations, and one conversation. */
export const MessagesStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MessagesList" component={MessagesListScreen} />
    <Stack.Screen name="MessageThread" component={MessageThreadScreen} />
  </Stack.Navigator>
);

export default MessagesStackNavigator;
