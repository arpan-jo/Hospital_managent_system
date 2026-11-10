import React, { memo, useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FAB, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PortalMessageThread, getFileUrl } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { MessagesStackParamList } from '../../../navigation/MessagesStackNavigator';
import RecordState from '../reports/RecordState';
import NewMessageSheet, { PickedDoctor } from './NewMessageSheet';
import { doctorInitial, threadTime } from './messagesUi';
import { useMessageThreads } from './useMessageThreads';

/** One conversation: the doctor, when it last moved, the last line, and what is unread. */
const ThreadRow = memo<{ thread: PortalMessageThread; months: string[]; onOpen: (thread: PortalMessageThread) => void }>(
  function ThreadRow({ thread, months, onOpen }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const muted = theme.colors.onSurfaceVariant;
    const unread = thread?.unreadCount ?? 0;
    const photo = getFileUrl(thread?.doctorPhotoUrl ?? '');
    const when = threadTime(thread?.lastAt, months, { today: t('messages.today'), yesterday: t('messages.yesterday') });
    const lastLine = thread?.lastMessage
      ? `${thread?.lastSenderType === 'patient' ? `${t('messages.you')}: ` : ''}${thread.lastMessage}`
      : t('messages.noMessagesYet');

    return (
      <Pressable
        onPress={() => onOpen(thread)}
        accessibilityRole="button"
        accessibilityLabel={`${thread?.doctorName || t('messages.doctor')}${unread ? `, ${t('messages.unreadCount', { count: unread })}` : ''}`}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.colors.surface, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <CustomAvatar
          type={photo ? 'image' : 'text'}
          value={photo || doctorInitial(thread?.doctorName)}
          fallback={doctorInitial(thread?.doctorName)}
          size={50}
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
              {thread?.doctorName || t('messages.doctor')}
            </Text>
            {when ? (
              <Text style={[styles.time, { color: unread ? theme.colors.primary : muted }]}>{when}</Text>
            ) : null}
          </View>
          <View style={styles.rowBottom}>
            <Text
              numberOfLines={1}
              style={[
                styles.last,
                unread
                  ? { color: theme.colors.onSurface, fontFamily: fontFamilies.semibold }
                  : { color: muted, fontFamily: fontFamilies.regular },
              ]}
            >
              {lastLine}
            </Text>
            {unread ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </View>
          {thread?.patientName ? (
            <View style={styles.patient}>
              <Icon name="account-outline" size={12} color={theme.colors.primary} />
              <Text numberOfLines={1} style={[styles.patientText, { color: theme.colors.primary }]}>
                {thread.patientName}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  },
);

/**
 * Messages — the patient's conversations with the doctors they have seen, as
 * the portal lists them: latest first, the unread ones in bold with a count,
 * and a new conversation with any doctor the patient has had an appointment with.
 */
export const MessagesListScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const navigation = useNavigation<NativeStackNavigationProp<MessagesStackParamList>>();
  const viewModel = useMessageThreads();
  const [picking, setPicking] = useState(false);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const openThread = useCallback(
    (thread: PortalMessageThread) => {
      if (!thread?.doctorEmployeeId || !thread?.patientRegistrationId) return;
      navigation.navigate('MessageThread', {
        patientRegistrationId: thread.patientRegistrationId,
        doctorEmployeeId: thread.doctorEmployeeId,
        doctorName: thread?.doctorName,
        doctorSpecialty: thread?.doctorSpecialty,
        doctorPhotoUrl: thread?.doctorPhotoUrl,
        patientName: thread?.patientName,
      });
    },
    [navigation],
  );

  const onPick = useCallback(
    ({ patientRegistrationId, patientName, doctor }: PickedDoctor) => {
      setPicking(false);
      navigation.navigate('MessageThread', {
        patientRegistrationId,
        doctorEmployeeId: doctor?.employeeId ?? 0,
        doctorName: doctor?.fullName,
        doctorSpecialty: doctor?.specialty,
        doctorPhotoUrl: doctor?.photoUrl,
        patientName,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: PortalMessageThread }) => <ThreadRow thread={item} months={months} onOpen={openThread} />,
    [months, openThread],
  );

  // The portal's amber note — the same warning tone as an amount owed.
  const noticeTint = theme.dark ? '#3A2E14' : '#FEF3E0';
  const noticeIcon = theme.dark ? '#F5C26B' : '#B27400';
  const noticeInk = theme.dark ? '#F5C26B' : '#8A5A00';
  const notice = (
    <View style={[styles.notice, { backgroundColor: noticeTint }]}>
      <Icon name="phone-alert-outline" size={16} color={noticeIcon} />
      <Text style={[styles.noticeText, { color: noticeInk }]}>
        {t('messages.emergencyNotice')}
      </Text>
    </View>
  );

  const empty = viewModel.isLoading ? (
    <RecordState loading />
  ) : viewModel.error !== null ? (
    <RecordState
      isError
      title={t('messages.loadFailed')}
      hint={viewModel.error || t('reports.recordsLoadFailedHint')}
      actionLabel={t('reports.tryAgain')}
      onAction={viewModel.retry}
    />
  ) : (
    <RecordState
      icon="message-text-outline"
      title={t('messages.emptyTitle')}
      hint={t('messages.emptyHint')}
      actionLabel={t('messages.newMessage')}
      actionIcon="plus"
      actionMode="contained"
      onAction={() => setPicking(true)}
    />
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={t('messages.title')} subtitle={t('messages.subtitle')} leading="menu" />
      <FlatList
        data={viewModel.isLoading || viewModel.error !== null ? [] : viewModel.threads}
        keyExtractor={(item, index) => `${item?.doctorEmployeeId}-${item?.patientRegistrationId}-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={notice}
        ListEmptyComponent={empty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
      {/* A new conversation does not need the list — the portal keeps its button
          even when the threads fail to load. The empty state has its own. */}
      {!viewModel.isLoading && (viewModel.error !== null || (viewModel.threads?.length ?? 0) > 0) ? (
        <FAB
          icon="plus"
          label={t('messages.newMessage')}
          onPress={() => setPicking(true)}
          color={theme.colors.onPrimary}
          style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 20 }]}
        />
      ) : null}
      <NewMessageSheet visible={picking} onClose={() => setPicking(false)} onPick={onPick} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 2,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  time: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  last: {
    flex: 1,
    fontSize: 13,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  patient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  patientText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  fab: {
    position: 'absolute',
    right: 16,
    borderRadius: 16,
  },
});

export default MessagesListScreen;
