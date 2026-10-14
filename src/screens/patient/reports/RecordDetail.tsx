import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { serverMessageOf } from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import RecordState from './RecordState';

/** One record read in full by its id; a failure keeps the server's words ('' when none). */
export const useRecordDetail = <T,>(fetcher: (id: number) => Promise<T>, id: number) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const response = await fetcherRef.current(id);
        setData(response);
        setError(null);
      } catch (e: any) {
        console.log('getRecord error ==>', e?.message);
        // A failed pull keeps the record already on screen.
        if (mode === 'initial') {
          setData(null);
          setError(serverMessageOf(e));
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    retry: () => load('initial'),
    refresh: () => load('refresh'),
  };
};

interface RecordDetailScreenProps {
  title: string;
  subtitle?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  /** Null when read; the server's words ('' for none) when it failed. */
  error: string | null;
  /** Ours, for when the server said nothing — "This report couldn't be opened." */
  errorFallback: string;
  onRetry: () => void;
  onRefresh: () => void;
  children?: ReactNode;
}

/** The frame every record opened from the Reports page sits in. */
export const RecordDetailScreen = ({
  title,
  subtitle,
  isLoading,
  isRefreshing,
  error,
  errorFallback,
  onRetry,
  onRefresh,
  children,
}: RecordDetailScreenProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={title} subtitle={subtitle} leading="back" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        refreshControl={
          error === null && !isLoading ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
      >
        {isLoading ? (
          <RecordState loading />
        ) : error !== null ? (
          <RecordState
            isError
            title={errorFallback}
            hint={error || undefined}
            actionLabel={t('reports.tryAgain')}
            onAction={onRetry}
          />
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/** A white card holding one part of a record. */
export const DetailCard = ({ children, style }: { children: ReactNode; style?: object }) => {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.colors.surface }, style]}>{children}</View>;
};

/** A part's heading — small, upper case, in the brand colour. */
export const DetailHeading = ({ icon, children }: { icon?: string; children: ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={styles.headingRow}>
      {icon ? <Icon name={icon} size={15} color={theme.colors.primary} /> : null}
      <Text style={[styles.heading, { color: theme.colors.primary }]}>{children}</Text>
    </View>
  );
};

/** Label / value pairs two to a row; a pair without a value is left out, and so is the grid when none has one. */
export const DetailFacts = ({ facts }: { facts: { label: string; value?: string | null }[] }) => {
  const theme = useTheme();
  const shown = facts.filter(fact => (fact.value ?? '').trim());
  if (!shown.length) return null;
  return (
    <View style={[styles.facts, { backgroundColor: theme.colors.surfaceVariant }]}>
      {shown.map(fact => (
        <View key={fact.label} style={styles.fact}>
          <Text style={[styles.factLabel, { color: theme.colors.onSurfaceVariant }]}>
            {fact.label}
          </Text>
          <Text selectable style={[styles.factValue, { color: theme.colors.onSurface }]}>
            {fact.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** Free text kept with its line breaks — nothing at all when blank. */
export const DetailProse = ({ text }: { text?: string | null }) => {
  const theme = useTheme();
  if (!(text ?? '').trim()) return null;
  return (
    <Text selectable style={[styles.prose, { color: theme.colors.onSurface }]}>
      {text}
    </Text>
  );
};

/** A titled block of free text — heading and all left out when the text is blank. */
export const DetailTextSection = ({ title, text }: { title: string; text?: string | null }) => {
  if (!(text ?? '').trim()) return null;
  return (
    <DetailCard>
      <DetailHeading>{title}</DetailHeading>
      <DetailProse text={text} />
    </DetailCard>
  );
};

/** A muted line for a record with nothing in it. */
export const DetailNote = ({ icon, children }: { icon: string; children: ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Icon name={icon} size={18} color={theme.colors.onSurfaceVariant} />
      <Text style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  heading: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  fact: {
    width: '50%',
    paddingRight: 8,
    paddingBottom: 10,
  },
  factLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  factValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 2,
  },
  prose: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 12,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
