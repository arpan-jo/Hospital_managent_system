import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PortalBill } from '@app/core';
import PatientBillIndex from '../screens/patient/bills/PatientBillIndex';
import BillDetailScreen from '../screens/patient/bills/BillDetailScreen';

export type BillsStackParamList = {
  BillsList: undefined;
  /** One bill in full — its items and payments came with the list, so nothing is read again. */
  BillDetail: { bill: PortalBill };
};

const Stack = createNativeStackNavigator<BillsStackParamList>();

/** Nested inside the drawer's "Bills" screen — its own back stack, own headers. */
export const BillsStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="BillsList" component={PatientBillIndex} />
    <Stack.Screen name="BillDetail" component={BillDetailScreen} />
  </Stack.Navigator>
);

export default BillsStackNavigator;
