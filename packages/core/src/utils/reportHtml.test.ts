import { decodeHtmlEntities, parseReportHtml, reportHtmlHasText } from './reportHtml';

describe('parseReportHtml', () => {
  it('keeps the allowed tags and their text', () => {
    expect(parseReportHtml('<p>Liver is <strong>normal</strong>.</p>')).toEqual([
      {
        type: 'element',
        tag: 'p',
        colSpan: 1,
        children: [
          { type: 'text', text: 'Liver is ' },
          { type: 'element', tag: 'strong', colSpan: 1, children: [{ type: 'text', text: 'normal' }] },
          { type: 'text', text: '.' },
        ],
      },
    ]);
  });

  it('drops dangerous tags with everything inside them', () => {
    expect(parseReportHtml('<p>a</p><script>alert(1)</script><style>p{}</style><p>b</p>')).toEqual([
      { type: 'element', tag: 'p', colSpan: 1, children: [{ type: 'text', text: 'a' }] },
      { type: 'element', tag: 'p', colSpan: 1, children: [{ type: 'text', text: 'b' }] },
    ]);
  });

  it('unwraps unknown tags but keeps their text', () => {
    expect(parseReportHtml('<a href="x">link</a><img src="y">')).toEqual([
      { type: 'text', text: 'link' },
    ]);
  });

  it('reads a cell span and nothing else from attributes', () => {
    const [table] = parseReportHtml('<table><tr><td colspan="2" style="color:red">x</td></tr></table>');
    const row = table.type === 'element' ? table.children[0] : null;
    const cell = row?.type === 'element' ? row.children[0] : null;
    expect(cell).toEqual({
      type: 'element',
      tag: 'td',
      colSpan: 2,
      children: [{ type: 'text', text: 'x' }],
    });
  });

  it('closes tags left open and ignores stray closing tags', () => {
    expect(parseReportHtml('</p><ul><li>one<li>two')).toEqual([
      {
        type: 'element',
        tag: 'ul',
        colSpan: 1,
        children: [
          {
            type: 'element',
            tag: 'li',
            colSpan: 1,
            children: [
              { type: 'text', text: 'one' },
              { type: 'element', tag: 'li', colSpan: 1, children: [{ type: 'text', text: 'two' }] },
            ],
          },
        ],
      },
    ]);
  });

  it('treats an empty value as no content', () => {
    expect(parseReportHtml(null)).toEqual([]);
    expect(parseReportHtml('')).toEqual([]);
  });
});

describe('reportHtmlHasText', () => {
  it('sees through empty markup', () => {
    expect(reportHtmlHasText('<p></p>')).toBe(false);
    expect(reportHtmlHasText('<p>&nbsp;</p>')).toBe(false);
    expect(reportHtmlHasText(undefined)).toBe(false);
    expect(reportHtmlHasText('<p>Impression: normal</p>')).toBe(true);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('a &amp; b &lt;5&gt; &#176;C &#x2014; &nbsp;x &unknown;')).toBe(
      'a & b <5> °C —  x &unknown;',
    );
  });
});
