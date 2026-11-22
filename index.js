/**
 * @format
 */

import { AppRegistry } from 'react-native';
import {
  handleAlarmEvent,
  handleFollowUpEvent,
  handleMedicineReminderEvent,
  registerNotificationHandlers,
} from '@app/core';
import App from './App';
import { name as appName } from './app.json';

// Before the app registers, so a reminder's OK and "Taken" and an alarm's stop
// work while the app is closed. Notifee keeps one handler for the whole app:
// every kind answers through this call.
// `?.`: a build missing any of them never crashes at launch over it.
registerNotificationHandlers?.(
  handleAlarmEvent,
  handleFollowUpEvent,
  handleMedicineReminderEvent,
);

AppRegistry.registerComponent(appName, () => App);
