import { useCallback, useEffect, useState } from 'react';
import { hasStoreUpdate, openStoreListing } from '@app/core';

/**
 * The update prompt: the Play Store is asked once per launch, and the prompt
 * shows when it has a newer build. Closing it only hides it for this launch —
 * it is not remembered, so it comes back the next time the app starts, until
 * the app is updated.
 */
export const useAppUpdate = () => {
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    hasStoreUpdate()
      .then(isAvailable => {
        if (isMounted && isAvailable === true) setVisible(true);
      })
      // hasStoreUpdate answers false on any failure; this only guards the launch.
      .catch((error: any) => console.log('app update check error ==>', error?.message));
    return () => {
      isMounted = false;
    };
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  /** Takes the user to the app's Play Store page, where the update is. */
  const update = useCallback(async () => {
    setVisible(false);
    try {
      await openStoreListing();
    } catch (error: any) {
      console.log('open store listing error ==>', error?.message);
    }
  }, []);

  return { isVisible, update, dismiss };
};
