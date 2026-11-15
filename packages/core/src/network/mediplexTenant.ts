/**
 * Akij Mediplex's account and branch on the live server, for the staff-side
 * routes the patient app has to call with them (a patient's own token carries
 * neither) — today only GetPrescriptionPrintData.
 *
 * STATIC: fixed live values, not read from any API — "Akij Mediplex Limited",
 * account 20402 / branch 40710, as the backend's own scripts name it
 * (DB_SCRIPT/SME/V_AccountModuleFeaturePermission_*.sql). Only the fallback:
 * the patient's own registration says which account and branch a prescription
 * is under (on live a patient can be under 20401 / 40709), and is asked first.
 * Drop this once the backend serves the print data by prescriptionId alone.
 */
export const MEDIPLEX_TENANT = { accountId: 20402, branchId: 40710 } as const;
