import { getRoot, getSnapshot, types } from 'mobx-state-tree';
import type { PatientProfile } from '../repositories/PatientRepository';

export const PatientProfileModel = types.model('PatientProfileModel', {
  patientProfileId: types.number,
  userId: types.number,
  // Optional: a profile saved by a build before this field has none.
  registrationId: types.optional(types.number, 0),
  patientCode: types.string,
  relationship: types.string,
  fullName: types.string,
  dateOfBirth: types.string,
  gender: types.string,
  bloodType: types.string,
  phone: types.string,
  email: types.string,
  address: types.string,
  emergencyContact: types.string,
  emergencyPhone: types.string,
  photoUrl: types.string,
  createdAt: types.string,
  updatedAt: types.string,
  // Optional: a profile saved by a build before these fields has none.
  identificationType: types.optional(types.string, ''),
  identificationNumber: types.optional(types.string, ''),
  registrationType: types.optional(types.string, ''),
  division: types.optional(types.string, ''),
  district: types.optional(types.string, ''),
  upazila: types.optional(types.string, ''),
  coName: types.optional(types.string, ''),
  coRelationship: types.optional(types.string, ''),
  coMobileNumber: types.optional(types.string, ''),
  emergencyRelationship: types.optional(types.string, ''),
  emergencyAddress: types.optional(types.string, ''),
  occupation: types.optional(types.string, ''),
  religion: types.optional(types.string, ''),
  nationality: types.optional(types.string, ''),
  identityMark: types.optional(types.string, ''),
});

/** What this store reads of its sibling `authStore` — typed here to keep the stores' imports one-way. */
interface SessionView {
  isAuthenticated: boolean;
  user: { userId: number } | null;
}

export const ProfileStore = types
  .model('ProfileStore', {
    patientProfile: types.maybeNull(PatientProfileModel),
  })
  /**
   * Screens read these rather than the model nodes themselves. Setting a
   * profile replaces its node, and anything still holding the old one throws
   * "no longer part of a state tree" the moment it reads a field — a snapshot
   * is a plain object, so it stays readable and is still tracked by `observer`.
   */
  .views(self => ({
    get patientProfileData(): PatientProfile | null {
      // Every field on the model is required, so the snapshot has them all —
      // MST's own snapshot type widens them to optional regardless.
      return self.patientProfile
        ? ({ ...getSnapshot(self.patientProfile) } as PatientProfile)
        : null;
    },
  }))
  .actions(self => ({
    /**
     * Kept only for the session that is signed in. A profile read started
     * before a logout can land after it; stored then, it would be the next
     * account's profile in the drawer and on My Profile.
     */
    setPatientProfile(profile: PatientProfile) {
      const auth = (getRoot(self) as { authStore?: SessionView })?.authStore;
      if (auth) {
        if (!auth.isAuthenticated) return;
        const signedIn = auth.user?.userId ?? 0;
        const owner = profile?.userId ?? 0;
        if (signedIn && owner && signedIn !== owner) return;
      }
      self.patientProfile = PatientProfileModel.create(profile);
    },
    clear() {
      self.patientProfile = null;
    },
  }));
