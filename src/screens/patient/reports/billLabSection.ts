/** What `billLabSection` reads off a test. */
interface BillTest {
  billCode?: string | null;
}

const sameCode = (code: string) => (test: BillTest | null | undefined) =>
  String(test?.billCode ?? '').trim().toLowerCase() === code;

/**
 * Which lab section a bill's tests are in, from the tests themselves: a bill's
 * type is the visit it was raised for (OPD, IPD, Consultation), not its lab.
 * Radiology only when that list alone has the bill; pathology otherwise —
 * a bill with both kinds, or neither, or a list that could not be read.
 * Both sections are searched by the code either way.
 */
export const billLabSection = (
  code: string | null | undefined,
  pathology: BillTest[] | null | undefined,
  radiology: BillTest[] | null | undefined,
): 'pathology' | 'radiology' => {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return 'pathology';
  const inRadiology = (Array.isArray(radiology) ? radiology : []).some(sameCode(key));
  const inPathology = (Array.isArray(pathology) ? pathology : []).some(sameCode(key));
  return inRadiology && !inPathology ? 'radiology' : 'pathology';
};

/**
 * Whether a bill has tests in both lab sections. Pathology opens then, and the
 * patient is told the radiology tests are under Radiology. The portal shows
 * every test of a bill on one page.
 */
export const billHasBothLabSections = (
  code: string | null | undefined,
  pathology: BillTest[] | null | undefined,
  radiology: BillTest[] | null | undefined,
): boolean => {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return false;
  return (
    (Array.isArray(pathology) ? pathology : []).some(sameCode(key)) &&
    (Array.isArray(radiology) ? radiology : []).some(sameCode(key))
  );
};
