import React, { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, TextStyle, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ReportHtmlNode, layoutReportTable, parseReportHtml } from '@app/core';
import { fontFamilies } from '@app/ui';

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'hr',
]);

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const HEADING_SIZE: Record<string, number> = { h1: 20, h2: 18, h3: 16.5, h4: 15, h5: 14, h6: 13.5 };

const isBlock = (node: ReportHtmlNode) => node.type === 'element' && BLOCK_TAGS.has(node.tag);

const INLINE_STYLE: Record<string, TextStyle> = {
  strong: { fontFamily: fontFamilies.bold },
  b: { fontFamily: fontFamilies.bold },
  em: { fontStyle: 'italic' },
  i: { fontStyle: 'italic' },
  u: { textDecorationLine: 'underline' },
  s: { textDecorationLine: 'line-through' },
  sub: { fontSize: 10 },
  sup: { fontSize: 10 },
  code: { fontFamily: MONO },
};

interface Palette {
  text: string;
  muted: string;
  border: string;
  headTint: string;
  codeTint: string;
}

/** Text and inline tags, drawn inside one <Text>. Whitespace collapses as it does in a browser. */
const renderInline = (node: ReportHtmlNode, key: string, palette: Palette, pre: boolean): ReactNode => {
  if (node.type === 'text') return pre ? node.text : node.text.replace(/\s+/g, ' ');
  if (node.tag === 'br') return '\n';
  const children = node.children.map((child, index) =>
    renderInline(child, `${key}.${index}`, palette, pre || node.tag === 'pre'),
  );
  // A block caught inside an inline tag still starts its own line.
  if (isBlock(node)) return <Text key={key}>{'\n'}{children}</Text>;
  const style = INLINE_STYLE[node.tag];
  return (
    <Text key={key} style={[style, node.tag === 'code' && { backgroundColor: palette.codeTint }]}>
      {children}
    </Text>
  );
};

/** Trims the run's outer whitespace; a run of nothing but spaces draws nothing. */
const trimRun = (run: ReportHtmlNode[]): ReportHtmlNode[] => {
  const nodes = [...run];
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (first?.type === 'text') nodes[0] = { type: 'text', text: first.text.replace(/^\s+/, '') };
  if (last?.type === 'text') {
    const end = nodes[nodes.length - 1];
    nodes[nodes.length - 1] = { type: 'text', text: (end as { text: string }).text.replace(/\s+$/, '') };
  }
  const hasContent = nodes.some(node =>
    node.type === 'text' ? node.text.trim() !== '' : true,
  );
  return hasContent ? nodes : [];
};

/** A block's children: runs of inline content become paragraphs of text, blocks stack under them. */
const renderBlocks = (
  nodes: ReportHtmlNode[],
  key: string,
  palette: Palette,
  textStyle: TextStyle,
): ReactNode[] => {
  const out: ReactNode[] = [];
  let run: ReportHtmlNode[] = [];

  const flush = () => {
    const trimmed = trimRun(run);
    run = [];
    if (!trimmed.length) return;
    const runKey = `${key}.t${out.length}`;
    out.push(
      <Text key={runKey} selectable style={textStyle}>
        {trimmed.map((node, index) => renderInline(node, `${runKey}.${index}`, palette, false))}
      </Text>,
    );
  };

  nodes.forEach((node, index) => {
    if (isBlock(node)) {
      flush();
      out.push(renderBlock(node, `${key}.${index}`, palette, textStyle));
    } else {
      run.push(node);
    }
  });
  flush();
  return out;
};

/** Every row of a table, wherever thead / tbody / tfoot put it. */
const tableRows = (nodes: ReportHtmlNode[]): ReportHtmlNode[] =>
  nodes.flatMap(node => {
    if (node.type !== 'element') return [];
    if (node.tag === 'tr') return [node];
    return node.tag === 'thead' || node.tag === 'tbody' || node.tag === 'tfoot'
      ? tableRows(node.children)
      : [];
  });

const renderBlock = (
  node: ReportHtmlNode,
  key: string,
  palette: Palette,
  textStyle: TextStyle,
): ReactNode => {
  if (node.type !== 'element') return null;

  switch (node.tag) {
    case 'hr':
      return <View key={key} style={[styles.rule, { backgroundColor: palette.border }]} />;
    case 'colgroup':
    case 'col':
      return null;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return (
        <View key={key} style={styles.block}>
          {renderBlocks(node.children, key, palette, {
            ...textStyle,
            fontFamily: fontFamilies.bold,
            fontSize: HEADING_SIZE[node.tag],
            lineHeight: HEADING_SIZE[node.tag] + 6,
          })}
        </View>
      );
    case 'pre':
      return (
        <Text key={key} selectable style={[textStyle, styles.pre, { backgroundColor: palette.codeTint }]}>
          {node.children.map((child, index) => renderInline(child, `${key}.${index}`, palette, true))}
        </Text>
      );
    case 'blockquote':
      return (
        <View key={key} style={[styles.block, styles.quote, { borderLeftColor: palette.border }]}>
          {renderBlocks(node.children, key, palette, { ...textStyle, color: palette.muted })}
        </View>
      );
    case 'ul':
    case 'ol': {
      let number = 0;
      return (
        <View key={key} style={styles.block}>
          {node.children.map((child, index) => {
            if (child.type !== 'element' || child.tag !== 'li') {
              return isBlock(child) ? renderBlock(child, `${key}.${index}`, palette, textStyle) : null;
            }
            number += 1;
            return (
              <View key={`${key}.${index}`} style={styles.listItem}>
                <Text style={[textStyle, styles.marker]}>{node.tag === 'ol' ? `${number}.` : '•'}</Text>
                <View style={styles.listBody}>
                  {renderBlocks(child.children, `${key}.${index}`, palette, textStyle)}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case 'table': {
      const caption = node.children.find(child => child.type === 'element' && child.tag === 'caption');
      return (
        <View key={key} style={styles.block}>
          {caption ? renderBlocks([caption], `${key}.c`, palette, textStyle) : null}
          <View style={[styles.table, { borderColor: palette.border }]}>
            {layoutReportTable(tableRows(node.children)).map((row, rowIndex) => (
              <View key={`${key}.r${rowIndex}`} style={styles.tableRow}>
                {row.map(({ cell, colSpan, continuesBelow }, cellIndex) => {
                  const isHead = cell?.tag === 'th';
                  return (
                    <View
                      key={`${key}.r${rowIndex}.${cellIndex}`}
                      style={[
                        styles.cell,
                        {
                          flex: colSpan,
                          borderColor: palette.border,
                          backgroundColor: isHead ? palette.headTint : undefined,
                        },
                        // A row-spanning cell reads as one box down its rows.
                        continuesBelow && styles.cellContinues,
                      ]}
                    >
                      {renderBlocks(
                        cell?.children ?? [],
                        `${key}.r${rowIndex}.${cellIndex}`,
                        palette,
                        isHead ? { ...textStyle, fontFamily: fontFamilies.semibold } : textStyle,
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      );
    }
    default:
      // p, div, li outside a list, caption, a stray cell.
      return (
        <View key={key} style={node.tag === 'p' || node.tag === 'div' ? styles.block : undefined}>
          {renderBlocks(node.children, key, palette, textStyle)}
        </View>
      );
  }
};

/**
 * A radiology report's body, drawn from its HTML with the app's own text —
 * only what the portal's sanitiser lets through is ever shown.
 */
export const ReportHtmlView = ({ html }: { html?: string | null }) => {
  const theme = useTheme();
  const nodes = useMemo(() => parseReportHtml(html), [html]);

  const palette: Palette = {
    text: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    border: theme.colors.outlineVariant,
    headTint: theme.colors.surfaceVariant,
    codeTint: theme.colors.surfaceVariant,
  };
  const textStyle: TextStyle = { ...styles.text, color: palette.text };

  return <View>{renderBlocks(nodes, 'r', palette, textStyle)}</View>;
};

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  block: {
    marginBottom: 8,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  pre: {
    fontFamily: MONO,
    fontSize: 12.5,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  marker: {
    width: 22,
  },
  listBody: {
    flex: 1,
  },
  table: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: 'row',
  },
  cell: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  cellContinues: {
    borderBottomWidth: 0,
  },
});

export default ReportHtmlView;
