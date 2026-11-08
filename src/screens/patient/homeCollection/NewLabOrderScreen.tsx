import React, { memo, useCallback, useMemo, useRef } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LabTestItem, formatLongDate, formatTaka, fromISODate, toISODate } from '@app/core';
import { CustomButton, CustomDatePicker, CustomInput, CustomSearchbar, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardOverlap } from '../../../hooks/useKeyboardOverlap';
import { useMonthNames } from '../../../hooks/useMonthNames';
import FilterPills, { FilterPill } from '../reports/FilterPills';
import { LAB_ORDER_SLOTS, quickDates } from './labOrderUi';
import { useNewLabOrder } from './useNewLabOrder';

/** One test on the hospital's list: picked or not, what kind, its instruments, its price. */
const TestRow = memo<{ item: LabTestItem; picked: boolean; onToggle: (item: LabTestItem) => void }>(function TestRow({
  item,
  picked,
  onToggle,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;
  const instruments = (item?.instruments ?? [])
    .map(line => `${line?.itemName ?? ''} ${formatTaka(line?.price)}`.trim())
    .join(', ');

  return (
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked }}
      style={({ pressed }) => [
        styles.testRow,
        {
          backgroundColor: picked ? theme.colors.primaryContainer : theme.colors.surface,
          borderColor: picked ? theme.colors.primary : theme.colors.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.check,
          picked
            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
            : { borderColor: theme.colors.outline },
        ]}
      >
        {picked ? <Icon name="check" size={14} color={theme.colors.onPrimary} /> : null}
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={2} style={[styles.testName, { color: theme.colors.onSurface }]}>
          {item?.itemName || '—'}
        </Text>
        <View style={styles.kindRow}>
          <Icon name={item?.kind === 'radiology' ? 'radiology-box-outline' : 'test-tube'} size={12} color={muted} />
          <Text style={[styles.testKind, { color: muted }]}>
            {t(item?.kind === 'radiology' ? 'homeCollection.kindHint.radiology' : 'homeCollection.kindHint.pathology')}
          </Text>
        </View>
        {instruments ? (
          <Text numberOfLines={2} style={[styles.testInstruments, { color: muted }]}>
            {`+ ${t('homeCollection.instruments')}: ${instruments}`}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.testPrice, { color: theme.colors.onSurface }]}>{formatTaka(item?.price)}</Text>
    </Pressable>
  );
});

/**
 * Booking a home collection, as the portal's two-step form: the tests from the
 * hospital's list, then where and when — on a phone, a full screen with the
 * running total and the next step pinned to the bottom, above the keyboard.
 */
export const NewLabOrderScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const navigation = useNavigation();
  const viewModel = useNewLabOrder();
  const rootRef = useRef<View>(null);
  const { overlap, isKeyboardOpen, remeasure } = useKeyboardOverlap(rootRef);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const muted = theme.colors.onSurfaceVariant;
  const { step, setStep, totals, picked } = viewModel;
  const dates = useMemo(() => quickDates(), []);
  const today = toISODate(new Date());

  // Back from the second step goes to the first, as the portal's Back does.
  const goBack = useCallback(() => {
    if (step === 2) {
      setStep(1);
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  }, [step, setStep, navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 2) {
          setStep(1);
          return true;
        }
        return false;
      });
      return () => subscription?.remove?.();
    }, [step, setStep]),
  );

  const place = useCallback(async () => {
    const placed = await viewModel.place();
    if (placed && navigation.canGoBack()) navigation.goBack();
  }, [viewModel, navigation]);

  const profilePills: FilterPill[] = useMemo(
    () =>
      (viewModel.profiles ?? []).map(profile => ({
        key: String(profile?.registrationId ?? ''),
        label: profile?.fullName || '—',
      })),
    [viewModel.profiles],
  );

  const renderTest = useCallback(
    ({ item }: { item: LabTestItem }) => (
      <TestRow item={item} picked={viewModel.isPicked(item?.itemId)} onToggle={viewModel.toggle} />
    ),
    [viewModel],
  );

  const stepLabels = [t('homeCollection.stepPick'), t('homeCollection.stepWhere')];
  // Over the keyboard the bar needs no room for the gesture bar.
  const footerBottom = isKeyboardOpen ? 10 : insets.bottom + 10;

  const breakdown = [
    `${t('homeCollection.tests')} ${formatTaka(totals.tests)}`,
    totals.instruments > 0 ? `${t('homeCollection.instruments')} ${formatTaka(totals.instruments)}` : '',
    totals.fee > 0 ? `${t('homeCollection.charge')} ${formatTaka(totals.fee)}` : '',
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View ref={rootRef} onLayout={remeasure} style={[styles.container, { paddingBottom: overlap }]}>
        <ScreenHeader
          title={t('homeCollection.book')}
          subtitle={t('homeCollection.stepOf', { step, label: stepLabels[step - 1] })}
          leading="back"
          onLeadingPress={goBack}
        />

        {/* ── The two steps ── */}
        <View style={styles.steps}>
          {stepLabels.map((label, index) => {
            const number = (index + 1) as 1 | 2;
            const reached = step >= number;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      { backgroundColor: reached ? theme.colors.primary : theme.colors.surfaceVariant },
                    ]}
                  >
                    {step > number ? (
                      <Icon name="check" size={12} color={theme.colors.onPrimary} />
                    ) : (
                      <Text style={[styles.stepNumber, { color: reached ? theme.colors.onPrimary : muted }]}>{number}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: step === number ? theme.colors.onSurface : muted,
                        fontFamily: step === number ? fontFamilies.semibold : fontFamilies.regular,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {index === 0 ? (
                  <View style={[styles.stepBar, { backgroundColor: step > 1 ? theme.colors.primary : theme.colors.outlineVariant }]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        {step === 1 ? (
          <FlatList
            data={viewModel.catalogue}
            keyExtractor={(item, index) => `${item?.itemId}-${index}`}
            renderItem={renderTest}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {profilePills.length > 1 ? (
                  <FilterPills
                    items={profilePills}
                    selected={String(viewModel.activeReg ?? '')}
                    onSelect={key => viewModel.pickProfile(Number(key) || 0)}
                  />
                ) : null}
                <CustomSearchbar
                  value={viewModel.search}
                  onChangeText={text => viewModel.setSearch(text ?? '')}
                  placeholder={t('homeCollection.searchTests')}
                />
                {picked.length ? (
                  <View style={styles.chips}>
                    {picked.map(item => (
                      <Pressable
                        key={item?.itemId}
                        onPress={() => viewModel.toggle(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('homeCollection.remove')} ${item?.itemName ?? ''}`}
                        style={[styles.chip, { backgroundColor: theme.colors.primary }]}
                      >
                        <Text numberOfLines={1} style={[styles.chipText, { color: theme.colors.onPrimary }]}>
                          {item?.itemName}
                        </Text>
                        <Icon name="close" size={13} color={theme.colors.onPrimary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              viewModel.isCatalogueLoading ? (
                <View style={styles.state}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : viewModel.catalogueError !== null ? (
                <View style={styles.state}>
                  <Text style={[styles.stateText, { color: muted }]}>
                    {viewModel.catalogueError || t('homeCollection.testsFailed')}
                  </Text>
                  <CustomButton mode="text" onPress={viewModel.retryCatalogue}>
                    {t('common.retry')}
                  </CustomButton>
                </View>
              ) : (
                <View style={styles.state}>
                  <Icon name="magnify" size={28} color={muted} />
                  <Text style={[styles.stateText, { color: muted }]}>{t('homeCollection.noTestsMatch')}</Text>
                </View>
              )
            }
          />
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── What is ordered ── */}
            <View style={[styles.summary, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                {t('homeCollection.selectedTests', { count: picked.length })}
              </Text>
              <Text style={[styles.summaryNames, { color: theme.colors.onSurface }]}>
                {picked.map(item => item?.itemName).filter(Boolean).join(', ')}
              </Text>
              {totals.lines.length ? (
                <Text style={[styles.summaryMeta, { color: muted }]}>
                  {`${t('homeCollection.instruments')}: ${totals.lines
                    .map(line => `${line?.itemName ?? ''} ${formatTaka(line?.price)}`)
                    .join(', ')}`}
                </Text>
              ) : null}
              {totals.instruments > 0 || totals.fee > 0 ? (
                <Text style={[styles.summaryMeta, { color: muted }]}>{breakdown}</Text>
              ) : null}
              <Text style={[styles.summaryTotal, { color: theme.colors.primary }]}>{formatTaka(totals.total)}</Text>
            </View>

            {/* ── Where ── */}
            <CustomInput
              label={`${t('homeCollection.address')} *`}
              value={viewModel.address}
              onChangeText={text => viewModel.setAddress(text ?? '')}
              placeholder={t('homeCollection.addressPlaceholder')}
              leftIcon="map-marker-outline"
              multiline
              numberOfLines={2}
            />
            <CustomInput
              label={t('homeCollection.phone')}
              value={viewModel.phone}
              onChangeText={text => viewModel.setPhone(text ?? '')}
              placeholder={viewModel.activeProfile?.phone || ''}
              leftIcon="phone-outline"
              keyboardType="phone-pad"
            />

            {/* ── When ── */}
            <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>{t('homeCollection.preferredDate')}</Text>
            <View style={styles.dateChips}>
              {[
                { label: t('homeCollection.tomorrow'), value: dates.tomorrow },
                { label: t('homeCollection.dayAfter'), value: dates.dayAfter },
              ].map(option => {
                const active = viewModel.date === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => viewModel.setDate(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text style={[styles.dateChipText, { color: active ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <CustomDatePicker
              label={t('homeCollection.otherDate')}
              value={fromISODate(viewModel.date)}
              minimumDate={fromISODate(today)}
              onChange={picked => {
                if (picked) viewModel.setDate(toISODate(picked));
              }}
              formatString={picked => formatLongDate(toISODate(picked), months)}
            />

            <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>{t('homeCollection.preferredTime')}</Text>
            <View style={styles.slots}>
              {LAB_ORDER_SLOTS.map(option => {
                const active = viewModel.slot === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => viewModel.setSlot(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <Icon name={option.icon} size={20} color={active ? theme.colors.primary : muted} />
                    <Text style={[styles.slotLabel, { color: active ? theme.colors.primary : theme.colors.onSurface }]}>
                      {t(option.labelKey)}
                    </Text>
                    <Text style={[styles.slotHint, { color: muted }]}>{t(option.hintKey)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <CustomInput
              label={`${t('homeCollection.note')} (${t('homeCollection.optional')})`}
              value={viewModel.note}
              onChangeText={text => viewModel.setNote(text ?? '')}
              placeholder={t('homeCollection.notePlaceholder')}
              leftIcon="note-text-outline"
            />
          </ScrollView>
        )}

        {/* ── The total and the way on ── */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: footerBottom,
            },
          ]}
        >
          {step === 1 ? (
            <>
              <View style={styles.flex}>
                <Text style={[styles.footerTotal, { color: theme.colors.onSurface }]}>
                  <Text style={[styles.footerCount, { color: muted }]}>
                    {`${t('homeCollection.testCount', { count: picked.length })} · `}
                  </Text>
                  {formatTaka(totals.total)}
                </Text>
                {totals.instruments > 0 ? (
                  <Text style={[styles.footerHint, { color: muted }]}>
                    {t('homeCollection.inclInstruments', { amount: formatTaka(totals.instruments) })}
                  </Text>
                ) : null}
                {totals.fee > 0 ? (
                  <Text style={[styles.footerHint, { color: muted }]}>
                    {t('homeCollection.inclCharge', { amount: formatTaka(totals.fee) })}
                  </Text>
                ) : null}
              </View>
              <CustomButton
                mode="contained"
                onPress={() => setStep(2)}
                disabled={!viewModel.canContinue}
                style={styles.footerButton}
              >
                {t('homeCollection.continue')}
              </CustomButton>
            </>
          ) : (
            <>
              <CustomButton mode="text" icon="chevron-left" onPress={() => setStep(1)} disabled={viewModel.isPlacing}>
                {t('common.back')}
              </CustomButton>
              <CustomButton
                mode="contained"
                icon="truck-fast-outline"
                onPress={place}
                disabled={!viewModel.canPlace}
                loading={viewModel.isPlacing}
                style={[styles.flex, styles.footerButton]}
              >
                {`${t('homeCollection.placeOrder')} · ${formatTaka(totals.total)}`}
              </CustomButton>
            </>
          )}
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
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  stepLabel: {
    fontSize: 12.5,
  },
  stepBar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  listHeader: {
    gap: 10,
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 999,
    paddingLeft: 11,
    paddingRight: 8,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    flexShrink: 1,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  testKind: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  testInstruments: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  testPrice: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  summary: {
    borderRadius: 16,
    padding: 14,
  },
  summaryLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  summaryNames: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginTop: 2,
  },
  summaryMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 4,
  },
  summaryTotal: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    marginTop: 6,
  },
  fieldLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
    marginTop: 4,
  },
  dateChips: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateChipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  slots: {
    flexDirection: 'row',
    gap: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 2,
  },
  slotLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  slotHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerTotal: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  footerCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  footerHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  footerButton: {
    borderRadius: 12,
  },
});

export default NewLabOrderScreen;
