/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { registerAlarmHandlers } from '@app/core';
import App from './App';
import { name as appName } from './app.json';

// Before the app registers, so an alarm's stop action works while the app is closed.
registerAlarmHandlers();

AppRegistry.registerComponent(appName, () => App);
