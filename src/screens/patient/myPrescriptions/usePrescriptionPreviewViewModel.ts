import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PatientPrescriptionRepository,
  PrescribedMedicine,
  PrescriptionDetail,
  PrescriptionLetterhead,
  PrescriptionPreview,
  PrescriptionSection,
  defaultPrescriptionPageLayout,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

const EMPTY_DETAIL: RequestState<PrescriptionDetail | null> = {
  isLoading: false,
  data: null,
  error: null,
};

const EMPTY_PREVIEW: RequestState<PrescriptionPreview | null> = {
  isLoading: false,
  data: null,
  error: null,
};

const EMPTY_LETTERHEAD: PrescriptionLetterhead = { hospital: [], columns: [], notice: '' };

/**
 * The record as one screen prints it, merged from the two calls behind it. The
 * preview is the printed document and wins wherever both carry a field; the
 * record adds what only it knows — the dates, and its own medicine rows.
 */
export interface PrescriptionDocument {
  rxId: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientCode: string;
  patientMobile: string;
  patientAddress: string;
  /** 'YYYY-MM-DD'; '' when only the preview answered. */
  issuedAt: string;
  /** 'YYYY-MM-DD'; '' when no follow-up was set. */
  nextVisit: string;
  /** Empty blocks when the doctor set no page layout up. */
  letterhead: PrescriptionLetterhead;
  /** Printed under the letterhead when it carries no doctor block of its own. */
  doctorName: string;
  doctorQualification: string;
  bmdcRegNo: string;
  specialty: string;
  hospital: string;
  chamberAddress: string;
  sections: PrescriptionSection[];
  medicinesTitle: string;
  medicines: PrescribedMedicine[];
}

/**
 * The printed prescription takes two calls: the record behind the row, and the
 * preview that carries the printed document itself — the letterhead, the
 * doctor's sections and the Rx. They are kept apart so either one failing
 * still leaves the other readable.
 */
export const usePrescriptionPreviewViewModel = (prescriptionId: string) => {
  const [detailRequest, setDetailRequest] =
    useState<RequestState<PrescriptionDetail | null>>(EMPTY_DETAIL);
  const [previewRequest, setPreviewRequest] =
    useState<RequestState<PrescriptionPreview | null>>(EMPTY_PREVIEW);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientPrescriptionRepository.getPrescriptionDetail(id);
      setDetailRequest({ isLoading: false, data: response ?? null, error: null });
    } catch (error: any) {
      console.log('getPrescriptionDetail error ==>', error?.message);
      setDetailRequest({ isLoading: false, data: null, error: error?.message ?? null });
    }
  }, []);

  const fetchPreview = useCallback(async (id: string) => {
    setPreviewRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientPrescriptionRepository.getPrescriptionPreview(id);
      setPreviewRequest({ isLoading: false, data: response ?? null, error: null });
    } catch (error: any) {
      console.log('getPrescriptionPreview error ==>', error?.message);
      setPreviewRequest({ isLoading: false, data: null, error: error?.message ?? null });
    }
  }, []);

  useEffect(() => {
    // A deep link can land here without an id; there is nothing to fetch then.
    if (!prescriptionId) return;

    fetchDetail(prescriptionId);
    fetchPreview(prescriptionId);
  }, [prescriptionId, fetchDetail, fetchPreview]);

  const prescription = detailRequest?.data ?? null;

  /**
   * Both calls key off the same id, so they must come back about the same
   * patient. If they disagree, the preview answered about a different record
   * and is dropped: a prescription must never print another patient's vitals.
   * Either side leaving the code out is not a disagreement.
   */
  const preview = useMemo(() => {
    const data = previewRequest?.data ?? null;
    if (!data || !prescription?.patientCode || !data?.patientCode) return data;

    return data.patientCode === prescription.patientCode ? data : null;
  }, [previewRequest, prescription]);

  /**
   * One record out of the two. Either call answering on its own is enough to
   * print something — the preview alone carries the whole document, and the
   * record alone still carries its dates and its own medicine rows.
   *
   * The preview wins wherever both hold a field: it *is* the printed document,
   * and its Rx keeps the brand, the generic and the route apart the way the
   * record prints them. The detail is read for what only it knows — the
   * prescription's date, the follow-up, and a doctor block for the letterhead
   * to fall back on.
   */
  const document = useMemo<PrescriptionDocument | null>(() => {
    if (!prescription && !preview) return null;

    // A row that came back with no name is not a medicine worth printing.
    const printed = (preview?.medicines ?? []).filter(medicine => medicine?.name);
    const prescribed = (prescription?.medicines ?? []).filter(medicine => medicine?.name);

    return {
      rxId: preview?.rxId || prescription?.rxId || '',
      patientName: preview?.patientName || prescription?.patientName || '',
      patientAge: preview?.patientAge || String(prescription?.patientAge ?? '') || '',
      patientGender: preview?.patientGender || prescription?.patientGender || '',
      patientCode: preview?.patientCode || prescription?.patientCode || '',
      patientMobile: preview?.patientMobile ?? '',
      patientAddress: preview?.patientAddress ?? '',
      issuedAt: prescription?.issuedAt ?? '',
      nextVisit: prescription?.nextVisit ?? '',
      letterhead: preview?.letterhead ?? EMPTY_LETTERHEAD,
      doctorName: prescription?.doctorName ?? '',
      doctorQualification: prescription?.doctorQualification ?? '',
      bmdcRegNo: prescription?.bmdcRegNo ?? '',
      specialty: prescription?.specialty ?? '',
      hospital: prescription?.hospital ?? '',
      chamberAddress: prescription?.chamberAddress ?? '',
      sections: preview?.sections ?? [],
      medicinesTitle: preview?.medicinesTitle ?? '',
      medicines: printed.length > 0 ? printed : prescribed,
    };
  }, [prescription, preview]);

  /**
   * What the server needs to render the PDF, or null when it cannot be built.
   *
   * Only the preview carries it — the record alone can be drawn on screen but
   * not printed, and a preview dropped for disagreeing about the patient must
   * not be printed either. A doctor who never designed a page still gets a PDF:
   * the portal prints on its default page then (`defaultLayout()`), and so does
   * this.
   */
  const printable = useMemo(() => {
    if (!preview) return null;

    return {
      layout: preview?.pageLayout ?? defaultPrescriptionPageLayout(),
      sectionData: preview?.sectionData ?? {},
      printSections: preview?.printSections ?? [],
      prescriptionCode: preview?.rxId ?? '',
      patient: {
        name: preview?.patientName ?? '',
        mobile: preview?.patientMobile ?? '',
        age: preview?.patientAge ?? '',
        gender: preview?.patientGender ?? '',
        address: preview?.patientAddress ?? '',
        patientCode: preview?.patientCode ?? '',
        // The printed page shows neither, and the patient's copy of a saved
        // record has no desk draft behind it to take them from.
        registrationId: 0,
        appointmentId: 0,
      },
    };
  }, [preview]);

  return {
    document,
    printable,
    isLoading: (detailRequest?.isLoading ?? false) || (previewRequest?.isLoading ?? false),
    /** Only a failure on both calls leaves nothing to print. */
    error: detailRequest?.error && previewRequest?.error ? detailRequest.error : null,
  };
};

export default usePrescriptionPreviewViewModel;
