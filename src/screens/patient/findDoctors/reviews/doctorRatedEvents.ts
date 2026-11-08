/**
 * A rating was just saved — the doctor lists read again so their stars are
 * current, as the portal reloads its doctor list after a review. Listeners are
 * the Find Doctors list (and its top-rated strip), wherever the rating came from.
 */
type Listener = (doctorEmployeeId: number) => void;

const listeners = new Set<Listener>();

/** Listen for a saved rating; answers the way to stop listening. */
export const onDoctorRated = (listener: Listener): (() => void) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Tell the listeners a rating for this doctor was saved. */
export const emitDoctorRated = (doctorEmployeeId: number): void => {
  listeners.forEach(listener => {
    try {
      listener?.(Number(doctorEmployeeId ?? 0) || 0);
    } catch (e: any) {
      console.log('doctor rated listener error ==>', e?.message);
    }
  });
};
