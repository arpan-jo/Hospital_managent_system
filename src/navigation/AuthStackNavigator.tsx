import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/login/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/forgotPassword/ForgotPasswordScreen';
import SignupScreen from '../screens/auth/signup/SignupScreen';
import VerifyEmailScreen from '../screens/auth/verifyEmail/VerifyEmailScreen';
import SetPasswordScreen from '../screens/auth/setPassword/SetPasswordScreen';
import ResetPasswordScreen from '../screens/auth/resetPassword/ResetPasswordScreen';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  Signup: undefined;
  /** Exactly one of `email` / `phone`: where the code went. */
  VerifyEmail: {
    email?: string;
    phone?: string;
    expiresInSeconds?: number;
  };
  SetPassword: {
    email?: string;
    phone?: string;
    /** Verified OTP, required to register. */
    code: string;
  };
  /** Forgot password by mobile: the number the reset code went to, `01XXXXXXXXX`. */
  ResetPassword: { phone: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};
export default AuthStackNavigator;
