import { types } from 'mobx-state-tree';
import { AuthStore } from './AuthStore';
import { ProfileStore } from './ProfileStore';
import type { PatientProfile } from '../repositories/PatientRepository';

/** The two stores as the root holds them, without the root's MMKV persistence. */
const Root = types.model({
  authStore: types.optional(AuthStore, {}),
  profileStore: types.optional(ProfileStore, {}),
});

const profileOf = (userId: number, fullName: string): PatientProfile =>
  ({
    patientProfileId: 1,
    userId,
    registrationId: 10,
    patientCode: 'REG-1',
    relationship: 'self',
    fullName,
    dateOfBirth: '1997-10-14',
    gender: 'Male',
    bloodType: 'B+',
    phone: '01711000000',
    email: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    photoUrl: '',
    createdAt: '',
    updatedAt: '',
  }) as PatientProfile;

const signIn = (root: ReturnType<typeof Root.create>, userId: number) =>
  root.authStore.login({ userId, token: 't', fullName: null, email: null, role: 'Patient', expiresAt: null } as any);

describe('ProfileStore.setPatientProfile', () => {
  it('keeps the signed-in account’s own profile', () => {
    const root = Root.create({});
    signIn(root, 18);
    root.profileStore.setPatientProfile(profileOf(18, 'Alamin'));
    expect(root.profileStore.patientProfileData?.fullName).toBe('Alamin');
  });

  it('drops a profile that lands after logout', () => {
    const root = Root.create({});
    signIn(root, 18);
    root.authStore.logout();
    root.profileStore.clear();
    root.profileStore.setPatientProfile(profileOf(18, 'Alamin'));
    expect(root.profileStore.patientProfileData).toBeNull();
  });

  it('drops another account’s profile', () => {
    const root = Root.create({});
    signIn(root, 5);
    root.profileStore.setPatientProfile(profileOf(18, 'Alamin'));
    expect(root.profileStore.patientProfileData).toBeNull();
  });

  it('accepts a profile that carries no owner id', () => {
    const root = Root.create({});
    signIn(root, 5);
    root.profileStore.setPatientProfile(profileOf(0, 'Jahed'));
    expect(root.profileStore.patientProfileData?.fullName).toBe('Jahed');
  });
});
