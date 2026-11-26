import type { NotificationTarget } from '@app/core';
import type { NavigationProp } from '@react-navigation/native';
import type { DrawerParamList } from '../../../navigation/DrawerNavigator';

/**
 * The app screen a portal link names — the same places the portal's links
 * lead. A list is opened with `pop`, back to the one already in its stack:
 * without it React Navigation 7 stacks a second list over a detail left open
 * there (and a bare tab shows whatever was left open), so Back reopened it.
 */
export const openNotificationTarget = (
  navigation: Pick<NavigationProp<DrawerParamList>, 'navigate'>,
  target: NotificationTarget,
) => {
  switch (target.screen) {
    case 'appointment':
      navigation.navigate('MainTabs', {
        screen: 'ActivityTab',
        params: {
          screen: 'AppointmentDetails',
          params: { appointmentId: target.appointmentId },
          initial: false,
        },
      });
      break;
    case 'appointments':
      navigation.navigate('MainTabs', {
        screen: 'ActivityTab',
        params: { screen: 'AppointmentsList', pop: true },
      });
      break;
    case 'followUps':
      // On Upcoming, where a newly scheduled follow-up is — not the tab left open last time.
      navigation.navigate('FollowUps', { openedAt: Date.now() });
      break;
    case 'messages':
      navigation.navigate('Messages', { screen: 'MessagesList', pop: true });
      break;
    case 'homeCollection':
      navigation.navigate('HomeCollection', { screen: 'HomeCollectionList', pop: true });
      break;
    case 'messageThread':
      navigation.navigate('Messages', {
        screen: 'MessageThread',
        params: {
          doctorEmployeeId: target.doctorEmployeeId,
          patientRegistrationId: target.patientRegistrationId,
        },
        initial: false,
      });
      break;
    case 'prescriptions':
      navigation.navigate('Prescriptions', { screen: 'MyPrescriptionsList', pop: true });
      break;
    case 'reports':
      navigation.navigate('MainTabs', {
        screen: 'ReportsTab',
        params: { screen: 'ReportsHome', pop: true },
      });
      break;
    case 'findDoctors':
      navigation.navigate('MainTabs', {
        screen: 'HomeTab',
        params: { screen: 'PatientFindDoctorIndex', pop: true },
      });
      break;
    case 'profile':
      navigation.navigate('MainTabs', {
        screen: 'ProfileTab',
        params: { screen: 'ProfileMain', pop: true },
      });
      break;
  }
};
