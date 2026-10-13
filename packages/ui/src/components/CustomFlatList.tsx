import React from 'react';
import {
  FlatList,
  FlatListProps,
  StyleSheet,
  View,
  Text,
  RefreshControl,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export interface CustomFlatListProps<T> extends Omit<FlatListProps<T>, 'data'> {
  data: T[] | null | undefined;
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyText?: string;
  emptyIcon?: string;
  emptyComponent?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  emptyContainerStyle?: StyleProp<ViewStyle>;
  emptyTextStyle?: StyleProp<TextStyle>;
}

export function CustomFlatList<T>({
  data,
  loading = false,
  loadingMore = false,
  onLoadMore,
  onRefresh,
  refreshing = false,
  emptyText = 'No items found',
  emptyIcon = 'folder-open-outline',
  emptyComponent,
  contentContainerStyle,
  emptyContainerStyle,
  emptyTextStyle,
  onEndReachedThreshold = 0.2,
  ...flatListProps
}: CustomFlatListProps<T>) {
  const theme = useTheme();

  // 1. Initial Loading State (when no data exists yet)
  if (loading && (!data || data.length === 0)) {
    return (
      <View style={[styles.centered, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // 2. Empty State
  const renderEmpty = () => {
    if (emptyComponent) {
      return emptyComponent;
    }
    return (
      <View style={[styles.centered, styles.emptyContainer, emptyContainerStyle]}>
        {emptyIcon ? (
          <Icon name={emptyIcon} size={48} color={theme.colors.outline} style={styles.emptyIcon} />
        ) : null}
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }, emptyTextStyle]}>
          {emptyText}
        </Text>
      </View>
    );
  };

  // 3. Bottom Loading State (fetching more data on end-scroll)
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  // 4. Refresh Control
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[theme.colors.primary]}
      tintColor={theme.colors.primary}
    />
  ) : undefined;

  const isListEmpty = !data || data.length === 0;

  return (
    <FlatList
      data={data || []}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      refreshControl={refreshControl}
      onEndReached={onLoadMore}
      onEndReachedThreshold={onEndReachedThreshold}
      contentContainerStyle={[
        isListEmpty && styles.emptyContent,
        contentContainerStyle,
      ]}
      // Performance Defaults
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={10}
      windowSize={21}
      initialNumToRender={10}
      {...flatListProps}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

export default CustomFlatList;
