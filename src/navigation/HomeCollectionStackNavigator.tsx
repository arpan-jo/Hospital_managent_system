import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LabOrder } from '@app/core';
import HomeCollectionIndex from '../screens/patient/homeCollection/HomeCollectionIndex';
import LabOrderDetailScreen from '../screens/patient/homeCollection/LabOrderDetailScreen';
import NewLabOrderScreen from '../screens/patient/homeCollection/NewLabOrderScreen';

export type HomeCollectionStackParamList = {
  HomeCollectionList: undefined;
  /** Everything the order sheet shows came with the list. */
  LabOrderDetail: { order: LabOrder };
  NewLabOrder: undefined;
};

const Stack = createNativeStackNavigator<HomeCollectionStackParamList>();

/** Home Collection — the orders, one order, and booking a new one. */
export const HomeCollectionStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeCollectionList" component={HomeCollectionIndex} />
    <Stack.Screen name="LabOrderDetail" component={LabOrderDetailScreen} />
    <Stack.Screen name="NewLabOrder" component={NewLabOrderScreen} />
  </Stack.Navigator>
);

export default HomeCollectionStackNavigator;
