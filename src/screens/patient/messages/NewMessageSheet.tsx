import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  MessageRepository,
  PatientProfile,
  PatientRepository,
  PortalMessageDoctor,
  getFileUrl,
  serverMessageOf,
} from '@app/core';
import { CustomAvatar, CustomBottomSheet, CustomButton, fontFamilies } from '@app/ui';
import FilterPills, { FilterPill } from '../reports/FilterPills';
import { doctorInitial } from './messagesUi';

export interface PickedDoctor {
  patientRegistrationId: number;
  patientName: string;
  doctor: PortalMessageDoctor;
}

interface NewMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (picked: PickedDoctor) => void;
}

/**
 * The portal's "Choose a doctor": whose conversation it is — the account's
 * first profile unless another is chosen — and the doctors that profile has
 * had an appointment with, the only ones a new conversation can go to.
 */
export const NewMessageSheet = memo<NewMessageSheetProps>(function NewMessageSheet({ visible, onClose, onPick }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;

  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [regId, setRegId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<PortalMessageDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Null once read; the server's words ('' for none) when the doctors could not be read. */
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const readRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // The profiles, each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setRegId(null);
    PatientRepository.getAllProfiles()
      .then(rows => {
        if (isMountedRef.current) setProfiles((rows ?? []).filter(profile => (profile?.registrationId ?? 0) > 0));
      })
      .catch((e: any) => {
        console.log('getAllProfiles (messages) error ==>', e?.message);
        if (isMountedRef.current) setProfiles([]);
      });
  }, [visible]);

  const activeReg = regId ?? profiles?.[0]?.registrationId ?? null;
  const activeProfile = profiles.find(profile => profile?.registrationId === activeReg) ?? null;

  const loadDoctors = useCallback(async () => {
    const read = ++readRef.current;
    if (!visible || !activeReg) {
      setDoctors([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const rows = await MessageRepository.getDoctors(activeReg);
      if (!isMountedRef.current || read !== readRef.current) return;
      setDoctors(rows ?? []);
    } catch (e: any) {
      if (!isMountedRef.current || read !== readRef.current) return;
      console.log('getMessageDoctors error ==>', e?.message);
      setDoctors([]);
      setError(serverMessageOf(e));
    } finally {
      if (isMountedRef.current && read === readRef.current) setIsLoading(false);
    }
  }, [visible, activeReg]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const pills: FilterPill[] = useMemo(
    () => profiles.map(profile => ({ key: String(profile?.registrationId ?? ''), label: profile?.fullName || '—' })),
    [profiles],
  );

  const pick = (doctor: PortalMessageDoctor) => {
    if (!activeReg || !doctor?.employeeId) return;
    onPick({ patientRegistrationId: activeReg, patientName: activeProfile?.fullName ?? '', doctor });
  };

  return (
    <CustomBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="message-plus-outline" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('messages.chooseDoctor')}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{t('messages.whoCanMessage')}</Text>
        </View>
      </View>

      {profiles.length > 1 ? (
        <View style={styles.pills}>
          <FilterPills
            items={pills}
            selected={String(activeReg ?? '')}
            onSelect={key => setRegId(Number(key) || null)}
          />
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error !== null ? (
          <View style={styles.state}>
            <Text style={[styles.stateText, { color: muted }]}>{error || t('messages.doctorsFailed')}</Text>
            <CustomButton mode="text" onPress={loadDoctors}>
              {t('common.retry')}
            </CustomButton>
          </View>
        ) : doctors.length === 0 ? (
          <View style={styles.state}>
            <Icon name="account-search-outline" size={30} color={muted} />
            <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>{t('messages.noDoctors')}</Text>
            <Text style={[styles.stateText, { color: muted }]}>{t('messages.noDoctorsHint')}</Text>
          </View>
        ) : (
          doctors.map(doctor => {
            const photo = getFileUrl(doctor?.photoUrl ?? '');
            return (
              <Pressable
                key={doctor?.employeeId}
                onPress={() => pick(doctor)}
                accessibilityRole="button"
                accessibilityLabel={doctor?.fullName}
                style={({ pressed }) => [
                  styles.doctor,
                  { borderColor: theme.colors.outlineVariant, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <CustomAvatar
                  type={photo ? 'image' : 'text'}
                  value={photo || doctorInitial(doctor?.fullName)}
                  fallback={doctorInitial(doctor?.fullName)}
                  size={44}
                />
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[styles.doctorName, { color: theme.colors.onSurface }]}>
                    {doctor?.fullName || t('messages.doctor')}
                  </Text>
                  {doctor?.specialty ? (
                    <Text numberOfLines={1} style={[styles.doctorRole, { color: muted }]}>
                      {doctor.specialty}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.go, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon name="message-text-outline" size={17} color={theme.colors.primary} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </CustomBottomSheet>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  pills: {
    marginBottom: 10,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  stateTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14.5,
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  doctor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  doctorName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14.5,
  },
  doctorRole: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 1,
  },
  go: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NewMessageSheet;
