import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../../components/ScreenHeader';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { ProfileStackParamList } from '../../../navigation/ProfileStackNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import ProfileTabs from './ProfileTabs';
import MedicalHistoryTab from './tabs/MedicalHistoryTab';
import AllergiesTab from './tabs/AllergiesTab';
import AddConditionSheet from '../../common/profileSheets/AddConditionSheet';
import AddAllergySheet from '../../common/profileSheets/AddAllergySheet';
import { ProfileTab } from './useProfileViewModel';
import { useMemberRecordsViewModel } from './useMemberRecordsViewModel';

/** The two the screen offers — the other two profile tabs have no meaning here. */
const MEMBER_TABS: readonly ProfileTab[] = ['medical', 'allergies'];

/**
 * A relative's medical history and allergies, with the same cards, sheets and
 * empty states the account holder's own tabs use — only the `patientCode` the
 * calls are scoped by differs. The family tab shows a count against each of
 * these links, so tapping one has to land somewhere that can add and remove.
 */
export const MemberRecordsScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<ProfileStackParamList, 'MemberRecords'>>();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const {
    patientCode = '',
    memberName = '',
    section = 'medical',
  } = route.params ?? {};

  const viewModel = useMemberRecordsViewModel(patientCode);
  // Opens on whichever link was tapped on the family card.
  const [tab, setTab] = useState<ProfileTab>(section);
  const [showConditionSheet, setShowConditionSheet] = useState(false);
  const [showAllergySheet, setShowAllergySheet] = useState(false);

  const openConditionSheet = useCallback(() => setShowConditionSheet(true), []);
  const closeConditionSheet = useCallback(() => setShowConditionSheet(false), []);
  const openAllergySheet = useCallback(() => setShowAllergySheet(true), []);
  const closeAllergySheet = useCallback(() => setShowAllergySheet(false), []);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={memberName || t('patientProfile.medicalAndAllergies')}
        subtitle={memberName ? t('patientProfile.medicalAndAllergies') : patientCode}
        leading="back"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Clears the floating tab bar — this stack lives in the Profile tab.
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <ProfileTabs value={tab} onChange={setTab} only={MEMBER_TABS} />

        <View style={styles.tabContent}>
          {tab === 'medical' ? (
            <MedicalHistoryTab
              conditions={viewModel.conditions}
              isLoading={viewModel.isConditionsLoading}
              onAdd={openConditionSheet}
              onRemove={viewModel.removeCondition}
            />
          ) : null}

          {tab === 'allergies' ? (
            <AllergiesTab
              allergies={viewModel.allergies}
              isLoading={viewModel.isAllergiesLoading}
              onAdd={openAllergySheet}
              onRemove={viewModel.removeAllergy}
            />
          ) : null}
        </View>
      </ScrollView>

      <AddConditionSheet
        visible={showConditionSheet}
        onClose={closeConditionSheet}
        onAdd={viewModel.addCondition}
      />
      <AddAllergySheet
        visible={showAllergySheet}
        onClose={closeAllergySheet}
        onAdd={viewModel.addAllergy}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  tabContent: {
    marginTop: 4,
  },
});

export default MemberRecordsScreen;
