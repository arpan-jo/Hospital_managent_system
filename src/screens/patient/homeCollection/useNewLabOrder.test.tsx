// Stable across renders, as the real stores are — a new object each render would re-run the hook's effects.
const mockStores = { toastStore: { show: jest.fn() } };
const mockT = (key: string) => key;

const mockRepos = {
  getAllProfiles: jest.fn(),
  getTestItems: jest.fn(),
  getInfo: jest.fn(),
  create: jest.fn(),
};

jest.mock('@app/core', () => ({
  LabOrderRepository: {
    getTestItems: (...args: any[]) => mockRepos.getTestItems(...args),
    getInfo: (...args: any[]) => mockRepos.getInfo(...args),
    create: (...args: any[]) => mockRepos.create(...args),
  },
  PatientRepository: { getAllProfiles: (...args: any[]) => mockRepos.getAllProfiles(...args) },
  labOrderTotals: () => ({}),
  serverMessageOf: () => '',
  toISODate: jest.requireActual('../../../../packages/core/src/utils/format').toISODate,
  useStores: () => mockStores,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));

import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { useNewLabOrder } from './useNewLabOrder';

const cbc = { itemId: 10, itemName: 'CBC' };
const xray = { itemId: 20, itemName: 'X-Ray Chest' };

let viewModel: ReturnType<typeof useNewLabOrder>;
const Probe = () => {
  viewModel = useNewLabOrder();
  return null;
};

const settle = async (run?: () => unknown) => {
  await act(async () => {
    await run?.();
  });
};

describe('useNewLabOrder — switching profile', () => {
  let renderer: ReactTestRenderer | undefined;
  let finishSecondList: (rows: unknown[]) => void = () => {};

  beforeEach(async () => {
    Object.values(mockRepos).forEach(fn => fn.mockReset());
    mockRepos.getAllProfiles.mockResolvedValue([
      { registrationId: 1, fullName: 'Al Amin' },
      { registrationId: 2, fullName: 'Rahima' },
    ]);
    mockRepos.getInfo.mockResolvedValue({ fee: 0 });
    // Profile 1's hospital answers at once; profile 2's waits until the test lets it.
    mockRepos.getTestItems.mockImplementation((registrationId: number) =>
      registrationId === 2
        ? new Promise(resolve => {
            finishSecondList = resolve;
          })
        : Promise.resolve([cbc]),
    );
    await settle(() => {
      renderer = TestRenderer.create(<Probe />);
    });
  });

  afterEach(async () => {
    await settle(() => renderer?.unmount());
  });

  it("reads the first profile's tests", () => {
    expect(viewModel.activeReg).toBe(1);
    expect(viewModel.catalogue).toEqual([cbc]);
  });

  it("drops the old hospital's tests at once, so none can be picked while the new list is read", async () => {
    await settle(() => viewModel.pickProfile(2));

    expect(viewModel.activeReg).toBe(2);
    expect(viewModel.catalogue).toEqual([]);
    expect(viewModel.isCatalogueLoading).toBe(true);

    await settle(() => finishSecondList([xray]));

    expect(viewModel.catalogue).toEqual([xray]);
    expect(viewModel.isCatalogueLoading).toBe(false);
  });
});
