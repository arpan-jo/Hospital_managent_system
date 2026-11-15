import { htmlToLines } from './htmlText';

describe('htmlToLines', () => {
  it('turns paragraphs and line breaks into lines, without the tags', () => {
    const html =
      '<p><span style="white-space: pre-wrap;">Dr. Tanjim Akter Tanha</span></p>' +
      '<p><span>MBBS, FCPS</span><br><span>Consultant, Gynaecology &amp; Obstetrics</span></p>';
    expect(htmlToLines(html)).toEqual([
      'Dr. Tanjim Akter Tanha',
      'MBBS, FCPS',
      'Consultant, Gynaecology & Obstetrics',
    ]);
  });

  it('keeps Bangla as it is and decodes numeric entities', () => {
    expect(htmlToLines('<p style="text-align: center;"><b>আপনার সুস্থতা&nbsp;ও নিরাপদ চিকিৎসা</b></p>')).toEqual([
      'আপনার সুস্থতা ও নিরাপদ চিকিৎসা',
    ]);
    expect(htmlToLines('A &#38; B &#x26; C')).toEqual(['A & B & C']);
  });

  it('drops blank lines, scripts and styles, and copes with nothing', () => {
    expect(htmlToLines('<p></p><p>  </p><style>p{}</style><script>x()</script><p>One</p>')).toEqual(['One']);
    expect(htmlToLines('')).toEqual([]);
    expect(htmlToLines(null)).toEqual([]);
    expect(htmlToLines(undefined)).toEqual([]);
  });
});
