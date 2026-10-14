import {
  ReportHtmlNode,
  decodeHtmlEntities,
  layoutReportTable,
  parseReportHtml,
  reportHtmlHasText,
} from './reportHtml';

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

describe('layoutReportTable', () => {
  /** The rows of the first table in `html`, as the view hands them over. */
  const rowsOf = (html: string): ReportHtmlNode[] => {
    const table = parseReportHtml(html)[0];
    const body = table?.type === 'element' ? table.children[0] : undefined;
    return body?.type === 'element' ? body.children : [];
  };
  /** Each row as its cells' text, '' for a place left under a cell from above. */
  const textOf = (rows: ReturnType<typeof layoutReportTable>) =>
    rows.map(row =>
      row.map(({ cell }) =>
        cell ? cell.children.map(child => (child.type === 'text' ? child.text : '')).join('') : '',
      ),
    );

  it('reads rowspan only on cells', () => {
    expect(parseReportHtml('<td rowspan="2">a</td>')).toEqual([
      { type: 'element', tag: 'td', colSpan: 1, rowSpan: 2, children: [{ type: 'text', text: 'a' }] },
    ]);
    expect(parseReportHtml('<p rowspan="2">a</p>')).toEqual([
      { type: 'element', tag: 'p', colSpan: 1, children: [{ type: 'text', text: 'a' }] },
    ]);
  });

  it('keeps the column a rowspan cell fills, so later cells stay in theirs', () => {
    const rows = layoutReportTable(
      rowsOf(
        '<table><tbody>' +
          '<tr><td rowspan="2">Kidney</td><td>10 cm</td></tr>' +
          '<tr><td>11 cm</td></tr>' +
          '<tr><td>Liver</td><td>14 cm</td></tr>' +
          '</tbody></table>',
      ),
    );
    expect(textOf(rows)).toEqual([['Kidney', '10 cm'], ['', '11 cm'], ['Liver', '14 cm']]);
    expect(rows.map(row => row.map(place => place.continuesBelow))).toEqual([
      [true, false],
      [false, false],
      [false, false],
    ]);
  });

  it('handles a span in a middle column and across columns', () => {
    const rows = layoutReportTable(
      rowsOf(
        '<table><tbody>' +
          '<tr><td>a</td><td rowspan="3" colspan="2">b</td><td>c</td></tr>' +
          '<tr><td>d</td><td>e</td></tr>' +
          '<tr><td>f</td><td>g</td></tr>' +
          '</tbody></table>',
      ),
    );
    expect(textOf(rows)).toEqual([['a', 'b', 'c'], ['d', '', 'e'], ['f', '', 'g']]);
    expect(rows[1][1]).toEqual({ cell: null, colSpan: 2, continuesBelow: true });
    expect(rows[2][1]).toEqual({ cell: null, colSpan: 2, continuesBelow: false });
  });

  it('stops at the table end and leaves a plain table as it is', () => {
    expect(textOf(layoutReportTable(rowsOf('<table><tbody><tr><td rowspan="5">a</td></tr></tbody></table>')))).toEqual([
      ['a'],
    ]);
    expect(
      textOf(layoutReportTable(rowsOf('<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>'))),
    ).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('counts a span down even where a later row runs over it', () => {
    const rows = layoutReportTable(
      rowsOf(
        '<table><tbody>' +
          '<tr><td>a</td><td rowspan="2">b</td></tr>' +
          '<tr><td colspan="2">wide</td></tr>' +
          '<tr><td>c</td><td>d</td></tr>' +
          '</tbody></table>',
      ),
    );
    expect(textOf(rows)).toEqual([['a', 'b'], ['wide'], ['c', 'd']]);
  });
});
