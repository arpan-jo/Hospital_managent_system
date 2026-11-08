import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LabOrderRepository,
  LabTestItem,
  PatientProfile,
  PatientRepository,
  labOrderTotals,
  serverMessageOf,
  useStores,
} from '@app/core';
import { LAB_ORDER_SLOTS, quickDates } from './labOrderUi';

/** As the portal waits before it searches — a word is typed, not each letter sent. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Booking a home collection, as the portal's two-step form runs it: whose it
 * is (the account's first profile unless another is chosen — choosing another
 * starts the picks afresh), the tests from that hospital's list, then where and
 * when. Tomorrow and the morning window are picked to begin with; the phone
 * falls back to the profile's own.
 */
export const useNewLabOrder = () => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [regId, setRegId] = useState<number | null>(null);
  const activeReg = regId ?? profiles?.[0]?.registrationId ?? null;
  const activeProfile = useMemo(
    () => profiles.find(profile => profile?.registrationId === activeReg) ?? null,
    [profiles, activeReg],
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [catalogue, setCatalogue] = useState<LabTestItem[]>([]);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(false);
  /** Null once read; the server's words ('' for none) when the list could not be read. */
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [fee, setFee] = useState(0);
  const [picked, setPicked] = useState<LabTestItem[]>([]);

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(() => quickDates().tomorrow);
  const [slot, setSlot] = useState<string>(LAB_ORDER_SLOTS[0].value);
  const [note, setNote] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const isMountedRef = useRef(true);
  const catalogueReadRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    PatientRepository.getAllProfiles()
      .then(rows => {
        if (isMountedRef.current) setProfiles((rows ?? []).filter(profile => (profile?.registrationId ?? 0) > 0));
      })
      .catch((e: any) => console.log('getAllProfiles (home collection) error ==>', e?.message));
  }, []);

  // The search goes out once the typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCatalogue = useCallback(async () => {
    const read = ++catalogueReadRef.current;
    if (!activeReg) return;
    setIsCatalogueLoading(true);
    setCatalogueError(null);
    try {
      const rows = await LabOrderRepository.getTestItems(activeReg, term);
      if (!isMountedRef.current || read !== catalogueReadRef.current) return;
      setCatalogue(rows ?? []);
    } catch (e: any) {
      if (!isMountedRef.current || read !== catalogueReadRef.current) return;
      console.log('getLabTestItems error ==>', e?.message);
      setCatalogue([]);
      setCatalogueError(serverMessageOf(e));
    } finally {
      if (isMountedRef.current && read === catalogueReadRef.current) setIsCatalogueLoading(false);
    }
  }, [activeReg, term]);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  // The charge belongs to the profile's hospital; until it is read there is none.
  useEffect(() => {
    if (!activeReg) return;
    let isCurrent = true;
    setFee(0);
    LabOrderRepository.getInfo(activeReg)
      .then(info => {
        if (isCurrent && isMountedRef.current) setFee(info?.fee ?? 0);
      })
      .catch((e: any) => console.log('getHomeCollectionInfo error ==>', e?.message));
    return () => {
      isCurrent = false;
    };
  }, [activeReg]);

  const pickProfile = useCallback((registrationId: number) => {
    setRegId(registrationId || null);
    setPicked([]);
  }, []);

  const isPicked = useCallback((itemId: number) => picked.some(item => item?.itemId === itemId), [picked]);

  const toggle = useCallback((item: LabTestItem) => {
    if (!item?.itemId) return;
    setPicked(previous =>
      previous.some(row => row?.itemId === item.itemId)
        ? previous.filter(row => row?.itemId !== item.itemId)
        : [...previous, item],
    );
  }, []);

  const totals = useMemo(() => labOrderTotals(picked, fee), [picked, fee]);

  const canContinue = picked.length > 0;
  const canPlace = !!activeReg && picked.length > 0 && address.trim().length > 0 && !!date && !isPlacing;

  /** True once placed; the caller leaves then. */
  const place = useCallback(async (): Promise<boolean> => {
    if (!canPlace || !activeReg) return false;
    setIsPlacing(true);
    try {
      await LabOrderRepository.create({
        patientRegistrationId: activeReg,
        itemIds: picked.map(item => item.itemId),
        collectionType: 'home',
        address,
        phone: phone || activeProfile?.phone || null,
        preferredDate: date || null,
        preferredTime: slot,
        note: note || null,
      });
      // The backend answers with the order and no words of its own.
      toastStore.show(t('homeCollection.placed'), 'success');
      return true;
    } catch (e: any) {
      console.log('createLabOrder error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('common.somethingWentWrong'), 'error');
      return false;
    } finally {
      if (isMountedRef.current) setIsPlacing(false);
    }
  }, [canPlace, activeReg, picked, address, phone, activeProfile, date, slot, note, toastStore, t]);

  return {
    profiles,
    activeReg,
    activeProfile,
    pickProfile,
    step,
    setStep,
    search,
    setSearch,
    catalogue,
    isCatalogueLoading,
    catalogueError,
    retryCatalogue: loadCatalogue,
    picked,
    isPicked,
    toggle,
    fee,
    totals,
    address,
    setAddress,
    phone,
    setPhone,
    date,
    setDate,
    slot,
    setSlot,
    note,
    setNote,
    canContinue,
    canPlace,
    isPlacing,
    place,
  };
};

export type NewLabOrderViewModel = ReturnType<typeof useNewLabOrder>;
