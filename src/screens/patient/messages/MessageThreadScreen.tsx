import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MESSAGE_MAX_LENGTH, getFileUrl } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { withAlpha } from '../../../components/ai/aiPalette';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardOverlap } from '../../../hooks/useKeyboardOverlap';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { MessagesStackParamList } from '../../../navigation/MessagesStackNavigator';
import RecordState from '../reports/RecordState';
import { ConversationItem, conversationItems, dayLabel, doctorInitial } from './messagesUi';
import { useMessageThread } from './useMessageThread';

/** The counter shows once a message nears the limit. */
const COUNTER_FROM = MESSAGE_MAX_LENGTH - 200;

/** One message: the patient's own on the right in the brand colour, the doctor's on the left. */
const Bubble = memo<{ item: Extract<ConversationItem, { kind: 'message' }> }>(function Bubble({ item }) {
  const theme = useTheme();
  const mine = item?.message?.senderType === 'patient';
  const ink = mine ? theme.colors.onPrimary : theme.colors.onSurface;

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine
            ? [styles.bubbleMine, { backgroundColor: theme.colors.primary }]
            : [styles.bubbleTheirs, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }],
        ]}
      >
        <Text selectable style={[styles.bubbleText, { color: ink }]}>
          {item?.message?.message ?? ''}
        </Text>
        {item?.time ? (
          <Text style={[styles.bubbleTime, { color: mine ? withAlpha(theme.colors.onPrimary, 0.72) : theme.colors.onSurfaceVariant }]}>
            {item.time}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

/** A day's heading in the middle of the conversation. */
const DayChip = ({ label }: { label: string }) => {
  const theme = useTheme();
  return (
    <View style={styles.dayRow}>
      <View style={[styles.dayChip, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.dayText, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      </View>
    </View>
  );
};

/**
 * One conversation with a doctor, as the portal's thread view runs it — laid
 * out as a phone's chat: the messages in bubbles under a heading for each day,
 * newest at the bottom, and the box to write in pinned above the keyboard.
 */
export const MessageThreadScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const navigation = useNavigation<NativeStackNavigationProp<MessagesStackParamList>>();
  const route = useRoute<RouteProp<MessagesStackParamList, 'MessageThread'>>();
  const params = route?.params;
  const viewModel = useMessageThread(params?.patientRegistrationId ?? 0, params?.doctorEmployeeId ?? 0);
  const [text, setText] = useState('');
  const rootRef = useRef<View>(null);
  /** The list runs newest at the bottom (inverted), so offset 0 is the latest message. */
  const listRef = useRef<FlatList<ConversationItem>>(null);
  const { overlap, isKeyboardOpen, remeasure } = useKeyboardOverlap(rootRef);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const thread = viewModel.thread;
  const doctorName = thread?.doctorName || params?.doctorName || t('messages.doctor');
  const photo = getFileUrl(thread?.doctorPhotoUrl || params?.doctorPhotoUrl || '');
  const subtitle = [thread?.doctorSpecialty || params?.doctorSpecialty, thread?.patientName || params?.patientName]
    .filter(Boolean)
    .join(' · ');

  // Newest first for the inverted list — it then reads oldest to newest, top to bottom.
  const items = useMemo(() => {
    const words = { today: t('messages.today'), yesterday: t('messages.yesterday') };
    return conversationItems(thread?.messages, day => dayLabel(day, months, words)).reverse();
  }, [thread?.messages, months, t]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MessagesList');
  }, [navigation]);

  const trimmed = text.trim();
  const canSend = !!trimmed && trimmed.length <= MESSAGE_MAX_LENGTH && !viewModel.isSending;

  const send = useCallback(async () => {
    if (!canSend) return;
    const sent = await viewModel.send(text);
    if (sent) {
      setText('');
      // The message just sent comes into view, even from far up the conversation, as on the portal.
      listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }
  }, [canSend, viewModel, text]);

  const renderItem = useCallback(
    ({ item }: { item: ConversationItem }) =>
      item.kind === 'day' ? <DayChip label={item.label} /> : <Bubble item={item} />,
    [],
  );

  const muted = theme.colors.onSurfaceVariant;
  // Over the keyboard the box needs no room for the gesture bar.
  const composerBottom = isKeyboardOpen ? 10 : insets.bottom + 10;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View ref={rootRef} onLayout={remeasure} style={[styles.container, { paddingBottom: overlap }]}>
        {/* ── Who the conversation is with ── */}
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.back}
          >
            <Icon name="arrow-left" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <CustomAvatar
            type={photo ? 'image' : 'text'}
            value={photo || doctorInitial(doctorName)}
            fallback={doctorInitial(doctorName)}
            size={40}
          />
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.headerName, { color: theme.colors.onSurface }]}>
              {doctorName}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[styles.headerSub, { color: muted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── The messages ── */}
        {viewModel.isLoading && !thread ? (
          <View style={styles.flex}>
            <RecordState loading />
          </View>
        ) : viewModel.error !== null && !thread ? (
          <View style={styles.flex}>
            <RecordState
              isError
              title={t('messages.threadFailed')}
              hint={viewModel.error || t('reports.recordsLoadFailedHint')}
              actionLabel={t('reports.tryAgain')}
              onAction={viewModel.retry}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.flex, styles.emptyWrap]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name="message-text-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{t('messages.threadEmpty')}</Text>
            <Text style={[styles.emptyHint, { color: muted }]}>{t('messages.threadEmptyHint')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={items}
            keyExtractor={item => item.key}
            renderItem={renderItem}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── The box to write in ── */}
        <View
          style={[
            styles.composer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: composerBottom,
            },
          ]}
        >
          <View style={[styles.inputShell, { backgroundColor: theme.colors.surfaceVariant }]}>
            <TextInput
              value={text}
              onChangeText={value => setText(value ?? '')}
              placeholder={t('messages.typeMessage')}
              placeholderTextColor={muted}
              multiline
              maxLength={MESSAGE_MAX_LENGTH}
              style={[styles.input, { color: theme.colors.onSurface }]}
              accessibilityLabel={t('messages.typeMessage')}
            />
            {text.length >= COUNTER_FROM ? (
              <Text style={[styles.counter, { color: muted }]}>{`${text.length}/${MESSAGE_MAX_LENGTH}`}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('messages.send')}
            accessibilityState={{ disabled: !canSend, busy: viewModel.isSending }}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: canSend || viewModel.isSending ? theme.colors.primary : theme.colors.surfaceVariant,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {viewModel.isSending ? (
              <ActivityIndicator size={18} color={theme.colors.onPrimary} />
            ) : (
              <Icon name="send" size={20} color={canSend ? theme.colors.onPrimary : muted} />
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  headerSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 1,
  },
  messages: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14.5,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  dayRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dayChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dayText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputShell: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  counter: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MessageThreadScreen;
