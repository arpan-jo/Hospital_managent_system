/**
 * Akij Mediplex's account and branch on the live server, for the
 * staff-side routes the patient app has to call with them (a patient's own
 * token carries none) — today only GetPrescriptionPrintData.
 *
 * STATIC (hardcoded): fixed live values, not read from any API —
 * account 20402 / branch 40710, "Akij Mediplex Limited".
 * The print data answers only for a prescription under this account and
 * branch; one under another tenant comes back 404 and the sheet is drawn
 * without it.
 * Drop this once the backend serves the print data by prescriptionId alone.
 */

// accountId 20401 / branchId 40709 (marie stops)
export const MEDIPLEX_TENANT = { accountId: 20402, branchId: 40710 } as const;
//for akij mediplex jahed bhai said it will static
