import {
  flattenSectionData,
  followUpDatesFromSectionData,
  medicinesFromSectionData,
} from './prescriptionSectionData';

const l = (text: string, note = '', isUrgent = false) => ({ text, note, isUrgent });
const unnamed = (...lines: ReturnType<typeof l>[]) => [{ groupName: '', lines }];
const groupsOf = (sectionData: unknown, key: string) =>
  flattenSectionData(sectionData).find(section => section.key === key)?.groups;

/** A real prescription from live, as the workstation saved it. */
const LIVE_SAMPLE =
  '{"rx":[{"type":"Tablet","generic":"Amiodarone Hydrochloride","brand":"Pacet [100 mg]","route":"Oral","dose":"০+০+১","durationValue":"2","durationUnit":"Days","isContinue":false,"isMixed":false,"note":"খাবারের আগে","lang":"bn"},{"type":"Suppository","generic":"Paracetamol","brand":"Napa [250 mg]","route":"Oral","dose":"১+০+০","durationValue":"2","durationUnit":"Days","isContinue":false,"isMixed":false,"note":"খাবারের আগে","lang":"bn"}],"physicalExamination":{"__vitals":{"Height Unit":"CM","Pulse (R)":"33","BP Sys":"55","Temperature":"88","SpO2 (%)":"11","Resp. Rate (/min)":"44","Weight (kg)":"55","Height (cm)":"66"},"__groups":[{"id":"__vitals","name":"Vitals"}]}}';

describe('the live sample', () => {
  it('flattens to the one Vitals section the backend answered with', () => {
    expect(flattenSectionData(LIVE_SAMPLE)).toEqual([
      {
        key: 'physicalExamination',
        label: 'Examination',
        groups: [
          {
            groupName: 'Vitals',
            lines: [
              l('Height Unit: CM'),
              l('Pulse (R): 33'),
              l('BP Sys: 55'),
              l('Temperature: 88'),
              l('SpO2 (%): 11'),
              l('Resp. Rate (/min): 44'),
              l('Weight (kg): 55'),
              l('Height (cm): 66'),
            ],
          },
        ],
      },
    ]);
  });

  it('reads the same parsed as from the string', () => {
    expect(flattenSectionData(JSON.parse(LIVE_SAMPLE))).toEqual(flattenSectionData(LIVE_SAMPLE));
  });

  it('reads both medicines out of rx', () => {
    const shared = {
      route: 'Oral',
      durationValue: '2',
      durationUnit: 'Days',
      isContinue: false,
      isMixed: false,
      note: 'খাবারের আগে',
      multiDose: [],
    };
    expect(medicinesFromSectionData(LIVE_SAMPLE)).toEqual([
      { ...shared, type: 'Tablet', generic: 'Amiodarone Hydrochloride', brand: 'Pacet [100 mg]', dose: '০+০+১' },
      { ...shared, type: 'Suppository', generic: 'Paracetamol', brand: 'Napa [250 mg]', dose: '১+০+০' },
    ]);
  });
});

describe('section order', () => {
  it('follows the canonical order and labels, whatever order the data is in', () => {
    const one = [{ tab: 'provisional', name: 'x' }];
    const data = {
      allergy: [{ name: 'x' }],
      followUp: [{ name: 'x' }],
      advice: [{ name: 'x' }],
      operation: [{ tab: 'operation', name: 'x' }],
      treatmentPlan: [{ name: 'x' }],
      disposal: [{ tab: 'disposal', name: 'x' }],
      btOrder: [{ name: 'x' }],
      referred: [{ tab: 'internal', name: 'x' }],
      services: [{ name: 'x' }],
      diagnosis: one,
      investigationFindings: [{ tab: 'notes', name: 'x' }],
      investigation: [{ name: 'x' }],
      chiefComplaint: [{ name: 'x' }],
      history: { g: { x: true } },
      physicalExamination: { g: { x: true } },
      rx: [{ brand: 'Napa' }],
      somethingNew: 'not listed',
    };
    expect(flattenSectionData(data).map(s => [s.key, s.label])).toEqual([
      ['physicalExamination', 'Examination'],
      ['history', 'History'],
      ['chiefComplaint', 'Chief Complaint'],
      ['investigation', 'Investigation'],
      ['investigationFindings', 'Investigation Finding'],
      ['diagnosis', 'Diagnosis'],
      ['services', 'Services'],
      ['referred', 'Referred'],
      ['btOrder', 'BT Order'],
      ['disposal', 'Disposal'],
      ['treatmentPlan', 'Treatment Plan'],
      ['operation', 'Operation'],
      ['advice', 'Advice'],
      ['followUp', 'Follow-up'],
      ['allergy', 'Allergy'],
    ]);
  });
});

describe('physical examination', () => {
  const exam = {
    __groups: [
      { id: 7, name: 'General Examination' },
      { id: '8', name: '' },
      { id: 'missing', name: 'Never filled' },
    ],
    __pastHistory: { Diabetes: true, Asthma: false },
    7: {
      Anaemia: true,
      Jaundice: false,
      Oedema: { value: 'mild', label: 'Mild' },
      Oedema_Note: '  pitting  ',
      'Chest X-ray': { value: 'sme-123', showOnMain: true },
      'Chest X-ray_Note': 'see film',
      'ECG Strip': { value: 'sme-456', showOnMain: false },
      'Blank image': { value: '', showOnMain: true },
      Pulse: 72,
      Grade: { value: 2, label: null },
      Cleared: { value: 'x', label: '' },
      Remarks: '   ',
      Tags: ['a'],
      __extraFields: ['Cyanosis'],
      Cyanosis: { durationValue: '3', durationUnit: 'Days' },
      __medicineItems: ['Napa'],
      Napa: { dose: '1+0+1', durationValue: '5', durationUnit: 'Days' },
      Napa_Note: 'after meal',
      __investigationItems: ['CBC'],
    },
    8: { Liver: 'Not palpable' },
  };

  it('renders fields, choices, images and added items group by group', () => {
    expect(groupsOf({ physicalExamination: exam }, 'physicalExamination')).toEqual([
      // Not in __groups, but a fixed group always shows — first.
      { groupName: 'Past History', lines: [l('Diabetes')] },
      {
        groupName: 'General Examination',
        lines: [
          l('Anaemia'),
          l('Oedema: Mild', 'pitting'),
          // Images show only the field's name (the app cannot fetch the SME id).
          l('Chest X-ray', 'see film'),
          l('ECG Strip'),
          l('Pulse: 72'),
          l('Grade: 2'),
          l('Cyanosis 3 days'),
          l('Napa 1+0+1 5 days', 'after meal'),
          l('CBC'),
        ],
      },
      // A group with no name of its own is named by its id.
      { groupName: 'Group 8', lines: [l('Liver: Not palpable')] },
    ]);
  });

  it('renders history the same way, under its own label', () => {
    expect(flattenSectionData({ history: { g1: { Smoker: true, Smoker_Note: '10 years' } } })).toEqual([
      { key: 'history', label: 'History', groups: [{ groupName: 'Group g1', lines: [l('Smoker', '10 years')] }] },
    ]);
  });

  it('puts the fixed groups first, as Vitals, Past History, Continue Medicine', () => {
    const data = {
      __continueMedicine: { Napa: true },
      __groups: [{ id: 'g', name: 'General' }],
      g: { Pallor: true },
      __vitals: { BP: '120/80' },
      __pastHistory: { HTN: true },
    };
    expect(groupsOf({ physicalExamination: data }, 'physicalExamination')?.map(g => g.groupName)).toEqual([
      'Vitals',
      'Past History',
      'Continue Medicine',
      'General',
    ]);
  });

  it('without __groups takes the groups in the order saved, fixed ones included', () => {
    const data = { g: { A: 'b' }, __vitals: { BP: '1' } };
    expect(groupsOf({ physicalExamination: data }, 'physicalExamination')).toEqual([
      { groupName: 'Group g', lines: [l('A: b')] },
      { groupName: 'Vitals', lines: [l('BP: 1')] },
    ]);
  });

  it('reads an added item that is not an object as just its name', () => {
    // The C# throws here (GetPrescription answered 500); the rest is kept instead.
    const data = {
      __groups: [{ id: 'g', name: 'G' }],
      g: { __extraFields: ['Clubbing'], Clubbing: 'present', __medicineItems: ['Napa'], Napa: null, Pallor: true },
    };
    expect(groupsOf({ physicalExamination: data }, 'physicalExamination')).toEqual([
      { groupName: 'G', lines: [l('Pallor'), l('Clubbing'), l('Napa')] },
    ]);
  });

  it('skips a section that is not an object', () => {
    expect(flattenSectionData({ physicalExamination: 'normal', history: [{ a: 1 }] })).toEqual([]);
  });
});

describe('chief complaint', () => {
  it('joins name, duration and body part', () => {
    const data = {
      chiefComplaint: [
        { name: 'Fever', durationValue: '3', durationUnit: 'Days', bodyPart: 'Whole body', note: 'High at night' },
        { name: 'Cough', durationValue: '', durationUnit: 'Weeks' },
        { name: '  ' },
        { name: 'Headache', durationValue: '2' },
      ],
    };
    expect(groupsOf(data, 'chiefComplaint')).toEqual(
      unnamed(l('Fever 3 days · Whole body', 'High at night'), l('Cough'), l('Headache 2')),
    );
  });

  it('binds field names in any case, as the C# serializer does', () => {
    const data = { chiefComplaint: [{ Name: 'Fever', DurationValue: '3', DURATIONUNIT: 'Days' }] };
    expect(groupsOf(data, 'chiefComplaint')).toEqual(unnamed(l('Fever 3 days')));
  });
});

describe('investigation', () => {
  it('dates the line and keeps the urgent flag', () => {
    const data = {
      investigation: [
        { name: 'CBC', itemId: 12, date: '2026-07-12', isUrgent: true, note: 'fasting' },
        { name: 'X-Ray Chest', date: '12/07/2026' },
        // .NET's \d takes Bangla digits too.
        { name: 'S. Creatinine', date: '২০২৬-০৭-১২' },
      ],
    };
    expect(groupsOf(data, 'investigation')).toEqual(
      unnamed(l('CBC 12/07/2026', 'fasting', true), l('X-Ray Chest 12/07/2026'), l('S. Creatinine ১২/০৭/২০২৬')),
    );
  });
});

describe('investigation findings', () => {
  it('groups notes and previous investigations', () => {
    const data = {
      investigationFindings: [
        { tab: 'previous', name: 'CBC', date: '2026-06-01', note: 'not shown' },
        { tab: 'notes', name: 'Hb', date: '2026-07-01', result: '11 g/dL', note: 'low' },
        { tab: 'notes', name: 'ESR' },
        { tab: 'other', name: 'Lost' },
      ],
    };
    expect(groupsOf(data, 'investigationFindings')).toEqual([
      { groupName: 'Investigation Findings Notes', lines: [l('Hb 01/07/2026 — 11 g/dL', 'low'), l('ESR')] },
      { groupName: 'Previous Investigation', lines: [l('CBC 01/06/2026')] },
    ]);
  });
});

describe('diagnosis', () => {
  it('groups provisional before final and marks a query', () => {
    const data = {
      diagnosis: [
        { tab: 'final', name: 'Viral fever', note: 'resolved' },
        { tab: 'provisional', name: 'Dengue fever', isQuery: true, durationValue: '3', durationUnit: 'Days' },
        { tab: 'provisional', name: 'Typhoid', isQuery: false },
        // Tabs are matched exactly.
        { tab: 'Final', name: 'Lost' },
      ],
    };
    expect(groupsOf(data, 'diagnosis')).toEqual([
      { groupName: 'Provisional Diagnosis', lines: [l('? Dengue fever 3 days'), l('Typhoid')] },
      { groupName: 'Final Diagnosis', lines: [l('Viral fever', 'resolved')] },
    ]);
  });
});

describe('services', () => {
  it('joins name, duration and session', () => {
    const data = {
      services: [
        { name: 'Physiotherapy', durationValue: '10', durationUnit: 'Days', session: 'Morning', note: 'daily' },
        { name: 'Nebulization' },
      ],
    };
    expect(groupsOf(data, 'services')).toEqual(
      unnamed(l('Physiotherapy 10 days · Morning', 'daily'), l('Nebulization')),
    );
  });
});

describe('referred', () => {
  it('names the doctor for internal and the department for external', () => {
    const data = {
      referred: [
        { tab: 'external', name: 'Eye check', doctorName: 'Not shown', departmentName: 'Ophthalmology' },
        { tab: 'internal', name: 'Cardiology consult', doctorId: 5, doctorName: 'Dr. Rahman', departmentName: 'x' },
        { tab: 'internal', name: 'Medicine consult' },
      ],
    };
    expect(groupsOf(data, 'referred')).toEqual([
      { groupName: 'Internal Referred', lines: [l('Cardiology consult — Dr. Rahman'), l('Medicine consult')] },
      { groupName: 'External Referred', lines: [l('Eye check — Ophthalmology')] },
    ]);
  });
});

describe('BT order', () => {
  it('lists each order with its note', () => {
    const data = { btOrder: [{ name: 'Whole blood 2 bags', note: 'O+' }, { name: '' }] };
    expect(groupsOf(data, 'btOrder')).toEqual(unnamed(l('Whole blood 2 bags', 'O+')));
  });
});

describe('disposal', () => {
  it('adds doctor and room to an admission, duration to a disposal', () => {
    const data = {
      disposal: [
        { tab: 'disposal', name: 'Bed rest', durationValue: '5', durationUnit: 'Days', note: 'at home' },
        { tab: 'admission', name: 'Cardiac monitoring', doctorId: 3, doctorName: 'Dr. Rahman', roomId: 2, roomName: 'CCU' },
        { tab: 'admission', name: 'Observation', roomName: 'Ward 4' },
        { tab: 'admission', name: 'Admit' },
      ],
    };
    expect(groupsOf(data, 'disposal')).toEqual([
      {
        groupName: 'Admission',
        lines: [l('Cardiac monitoring — Dr. Rahman, CCU'), l('Observation — Ward 4'), l('Admit')],
      },
      { groupName: 'Disposal', lines: [l('Bed rest 5 days', 'at home')] },
    ]);
  });
});

describe('treatment plan', () => {
  it('joins step, dates and the done mark', () => {
    const data = {
      treatmentPlan: [
        { name: 'Physiotherapy', step: '2', plannedDate: '2026-07-12', treatmentDate: '2026-07-15', isCompleted: true },
        { name: 'Dressing', treatmentDate: '2026-07-20' },
        { name: 'Review', isCompleted: false, note: 'if pain' },
      ],
    };
    expect(groupsOf(data, 'treatmentPlan')).toEqual(
      unnamed(l('Physiotherapy (Step 2) 12/07/2026 → 15/07/2026 ✓'), l('Dressing 20/07/2026'), l('Review', 'if pain')),
    );
  });
});

describe('operation', () => {
  it('groups operations and procedures, urgent only on an operation', () => {
    const data = {
      operation: [
        { tab: 'procedure', name: 'Suturing', isUrgent: true },
        { tab: 'operation', name: 'Appendectomy', date: '2026-07-12', isUrgent: true, note: 'NPO' },
      ],
    };
    expect(groupsOf(data, 'operation')).toEqual([
      { groupName: 'Operation', lines: [l('Appendectomy 12/07/2026', 'NPO', true)] },
      { groupName: 'Procedure / Minor OT', lines: [l('Suturing')] },
    ]);
  });
});

describe('advice', () => {
  it('prints the Bangla name when the doctor switched to বাংলা', () => {
    const data = {
      advice: [
        { name: 'Drink plenty of water', nameBangla: 'প্রচুর পানি পান করবেন', lang: 'bn' },
        { name: 'Take rest', nameBangla: 'বিশ্রাম নিন', lang: 'en', note: '2 weeks' },
        { name: 'Avoid oily food', lang: 'bn' },
      ],
    };
    expect(groupsOf(data, 'advice')).toEqual(
      unnamed(l('প্রচুর পানি পান করবেন'), l('Take rest', '2 weeks'), l('Avoid oily food')),
    );
  });
});

describe('follow-up', () => {
  const text = (item: Record<string, unknown>) => groupsOf({ followUp: [item] }, 'followUp')?.[0]?.lines[0]?.text;

  it('joins name, duration and date in English', () => {
    expect(
      text({ name: 'Physiotherapy', durationValue: '5', durationUnit: 'Days', followupDate: '2026-07-12' }),
    ).toBe('Physiotherapy 5 days 12/07/2026');
  });

  it('fills a Bangla name that places {duration} itself, the date in brackets', () => {
    expect(
      text({
        name: 'Come again',
        nameBangla: '{duration} পর পুনরায় আসবেন',
        lang: 'bn',
        durationValue: '3',
        durationUnit: 'Days',
        followUpDate: '2026-10-14',
      }),
    ).toBe('৩ দিন পর পুনরায় আসবেন (১৪/১০/২০২৬)');
  });

  it('leaves the date where a {date} name puts it', () => {
    expect(
      text({ name: 'Come on', nameBangla: '{date}   তারিখে আসবেন', lang: 'bn', followupDate: '2026-10-14' }),
    ).toBe('১৪/১০/২০২৬ তারিখে আসবেন');
  });

  it('puts the time in front of a name that starts with পর', () => {
    expect(
      text({
        name: 'Come again',
        nameBangla: 'পর পুনরায় আসবেন',
        lang: 'bn',
        durationValue: '2',
        durationUnit: 'Weeks',
        followupDate: '2026-10-14',
      }),
    ).toBe('২ সপ্তাহ পর পুনরায় আসবেন (১৪/১০/২০২৬)');
  });

  it('otherwise writes "name, time পর (date)"', () => {
    expect(text({ name: 'Review', nameBangla: 'রিভিউ', lang: 'bn', durationValue: '1', durationUnit: 'Months' })).toBe(
      'রিভিউ ১ মাস পর',
    );
    // No Bangla name: the English one, still with Bangla digits; an unknown unit as it is.
    expect(text({ name: 'Follow up', lang: 'bn', durationValue: '4', durationUnit: 'Hours' })).toBe(
      'Follow up ৪ hours পর',
    );
  });
});

describe('allergy', () => {
  it('marks a medicine allergy and its severity', () => {
    const data = {
      allergy: [
        { name: 'Penicillin', type: 'medicine', severity: 'Severe', note: 'rash' },
        { name: 'Dust', type: 'food' },
      ],
    };
    expect(groupsOf(data, 'allergy')).toEqual(unnamed(l('Penicillin (Medicine) - Severe', 'rash'), l('Dust')));
  });
});

describe('edge cases', () => {
  const junk: unknown[] = [null, undefined, '', '   ', 'not json', '{"advice": [', '[]', '"text"', '42', 42, true, [], () => 1];

  it('reads anything that is not a JSON object as nothing', () => {
    junk.forEach(value => {
      expect(flattenSectionData(value)).toEqual([]);
      expect(medicinesFromSectionData(value)).toEqual([]);
    });
  });

  it('drops sections with nothing to show', () => {
    const data = {
      physicalExamination: { __groups: [], __vitals: {} },
      // A section saved as plain text has no array to read, as on the backend.
      history: 'smoker',
      allergy: 'Penicillin',
      advice: [],
      diagnosis: [{ tab: 'provisional', name: ' ' }],
      chiefComplaint: null,
      followUp: {},
    };
    expect(flattenSectionData(data)).toEqual([]);
  });

  it('matches section keys exactly', () => {
    expect(flattenSectionData({ Advice: [{ name: 'Rest' }] })).toEqual([]);
    expect(medicinesFromSectionData({ RX: [{ brand: 'Napa' }] })).toEqual([]);
  });

  it('skips items and fields of the wrong type instead of failing', () => {
    // The C# serializer throws on each of these; only that value is lost here.
    const data = {
      advice: [null, 'Rest', 5, ['x'], { name: 5 }, { NAME: '  Sleep early  ' }, { name: 'Walk', note: 3 }],
    };
    expect(groupsOf(data, 'advice')).toEqual(unnamed(l('Sleep early'), l('Walk')));
  });

  it('counts white space as .NET does', () => {
    // U+0085 is blank to .NET; U+00A0 is trimmed by both.
    const data = { btOrder: [{ name: '\u0085' }, { name: ' Plasma ', note: '\u0085' }] };
    expect(groupsOf(data, 'btOrder')).toEqual(unnamed(l('Plasma')));
  });

  it('reads the JSON string the same as the object', () => {
    const data = {
      diagnosis: [{ tab: 'final', name: 'Viral fever' }],
      advice: [{ name: 'Rest' }],
      physicalExamination: { __vitals: { BP: '120/80' } },
    };
    expect(flattenSectionData(JSON.stringify(data))).toEqual(flattenSectionData(data));
    expect(flattenSectionData(data)).toHaveLength(3);
  });
});

describe('medicinesFromSectionData', () => {
  it('reads multi-dose periods and trims the brand', () => {
    const data = {
      rx: [
        {
          type: 'Tablet',
          generic: 'Paracetamol',
          brand: '  Napa  ',
          route: 'Oral',
          isContinue: true,
          multiDose: [
            { dose: '1+0+1', durationValue: '5', durationUnit: 'Days', note: 'after meal' },
            { Dose: '0+0+1', DurationValue: '10', DurationUnit: 'Days' },
            null,
          ],
        },
      ],
    };
    expect(medicinesFromSectionData(data)).toEqual([
      {
        type: 'Tablet',
        generic: 'Paracetamol',
        brand: 'Napa',
        route: 'Oral',
        dose: '',
        durationValue: '',
        durationUnit: '',
        isContinue: true,
        isMixed: false,
        note: '',
        multiDose: [
          { dose: '1+0+1', durationValue: '5', durationUnit: 'Days', note: 'after meal' },
          { dose: '0+0+1', durationValue: '10', durationUnit: 'Days', note: '' },
        ],
      },
    ]);
  });

  it('skips a medicine with no brand, and reads flags only when true', () => {
    const data = {
      rx: [
        { brand: '   ', generic: 'Paracetamol' },
        { generic: 'No brand' },
        null,
        { brand: 'Seclo', isMixed: 'true', multiDose: 'none' },
      ],
    };
    expect(medicinesFromSectionData(data)).toEqual([
      expect.objectContaining({ brand: 'Seclo', isMixed: false, isContinue: false, multiDose: [] }),
    ]);
  });

  it('reads no medicines when rx is missing or not a list', () => {
    expect(medicinesFromSectionData({ advice: [] })).toEqual([]);
    expect(medicinesFromSectionData({ rx: { brand: 'Napa' } })).toEqual([]);
  });
});

describe('followUpDatesFromSectionData', () => {
  it('the Follow-up section\'s dates, each once, as written', () => {
    const data = {
      followUp: [
        { name: 'Next Follow-up', durationValue: '7', durationUnit: 'Days', followupDate: '2026-11-25' },
        { name: 'Review with reports', followUpDate: ' 2026-12-18 ' },
        { name: 'Come again', followupDate: '2026-11-25' },
      ],
    };

    expect(followUpDatesFromSectionData(data)).toEqual(['2026-11-25', '2026-12-18']);
  });

  it('skips a line the sheet does not show (no name) and one with no date', () => {
    const data = {
      followUp: [
        { name: '', followupDate: '2026-11-25' },
        { followupDate: '2026-11-26' },
        { name: 'Next Follow-up', durationValue: '7', durationUnit: 'Days' },
        { name: 'Next Follow-up', followupDate: 20261127 },
      ],
    };

    expect(followUpDatesFromSectionData(data)).toEqual([]);
  });

  it('never reads another section — a physiotherapy course in advice or services is not a follow-up', () => {
    const data = {
      advice: [{ name: 'Physiotherapy', followupDate: '2026-11-25' }],
      services: [{ name: 'Physiotherapy', date: '2026-11-25' }],
      treatmentPlan: [{ name: 'Physiotherapy', followupDate: '2026-11-25' }],
    };

    expect(followUpDatesFromSectionData(data)).toEqual([]);
  });

  it('reads the JSON copy, and copes with nothing', () => {
    expect(
      followUpDatesFromSectionData(JSON.stringify({ followUp: [{ name: 'Next Follow-up', followupDate: '2026-11-25' }] })),
    ).toEqual(['2026-11-25']);
    expect(followUpDatesFromSectionData(null)).toEqual([]);
    expect(followUpDatesFromSectionData('not json')).toEqual([]);
    expect(followUpDatesFromSectionData({ followUp: 'x' })).toEqual([]);
  });
});
