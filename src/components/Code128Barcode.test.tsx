// The barcode drawn as views: nothing until it knows its width, then whole
// device pixels a module, and the fallback for a code it cannot draw.
import React from 'react';
import { PixelRatio, StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Code128Barcode } from './Code128Barcode';
import { code128Width, encodeCode128 } from './code128';

const CODE = 'PRS-20261017-000000001';

let renderer: ReactTestRenderer | undefined;

afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
    renderer = undefined;
  }
  jest.restoreAllMocks();
});

const draw = (element: React.ReactElement) => {
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer as ReactTestRenderer;
};

/** The outer box, which measures the width it is given. */
const box = (tree: ReactTestRenderer) =>
  tree.root.findAll(node => String(node.type) === 'View' && typeof node.props?.onLayout === 'function')[0];

const layOut = (tree: ReactTestRenderer, width: number) => {
  act(() => {
    box(tree)?.props?.onLayout?.({ nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } } });
  });
};

/** The bar and space views, left to right. */
const elements = (tree: ReactTestRenderer) => {
  const row = tree.root.findAll(
    // Host views only — each composite View wraps one, with the same props.
    node => String(node.type) === 'View' && StyleSheet.flatten(node.props?.style)?.flexDirection === 'row',
  )[0];
  return (row?.children ?? []).filter((child): child is TestRenderer.ReactTestInstance => typeof child !== 'string');
};

describe('Code128Barcode', () => {
  it('draws nothing until its width is known, and names the code for screen readers', () => {
    const tree = draw(<Code128Barcode value={CODE} accessibilityLabel="Rx No. PRS" />);
    expect(elements(tree)).toHaveLength(0);
    expect(box(tree)?.props?.accessibilityLabel).toBe('Rx No. PRS');
  });

  it('gives every module the same whole number of device pixels', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(2.625);
    const tree = draw(<Code128Barcode value={CODE} maxModulePx={4} />);
    layOut(tree, 300);

    const modules = encodeCode128(CODE) ?? [];
    const drawn = elements(tree);
    expect(drawn).toHaveLength(modules.length);

    // 300 dp × 2.625 = 787 px over 222 + 20 quiet modules → 3 px a module.
    const moduleDp = 3 / 2.625;
    drawn.forEach((element, index) => {
      const style = StyleSheet.flatten(element.props?.style);
      expect(style?.width).toBeCloseTo(modules[index] * moduleDp, 6);
      // Bars on the even places, spaces (no colour) on the odd.
      expect(Boolean(style?.backgroundColor)).toBe(index % 2 === 0);
    });
    const total = drawn.reduce((sum, element) => sum + Number(StyleSheet.flatten(element.props?.style)?.width ?? 0), 0);
    expect(total).toBeCloseTo(code128Width(modules) * moduleDp, 6);
    expect(total + 20 * moduleDp).toBeLessThanOrEqual(300);
  });

  it('caps the module width, and shows the fallback when even one pixel a module will not fit', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(1);
    const wide = draw(<Code128Barcode value={CODE} maxModulePx={2} />);
    layOut(wide, 5000);
    const first = StyleSheet.flatten(elements(wide)[0]?.props?.style);
    expect(first?.width).toBe((encodeCode128(CODE) ?? [])[0] * 2);

    act(() => wide.unmount());
    renderer = undefined;

    // 242 modules need 242 px; 240 cannot hold them, so the bars would be cut short.
    const narrow = draw(<Code128Barcode value={CODE} fallback={<Text>text instead</Text>} />);
    layOut(narrow, 240);
    expect(elements(narrow)).toHaveLength(0);
    expect(narrow.root.findAllByType(Text).map(node => node.props.children)).toEqual(['text instead']);

    act(() => narrow.unmount());
    renderer = undefined;

    const exact = draw(<Code128Barcode value={CODE} />);
    layOut(exact, 242);
    expect(StyleSheet.flatten(elements(exact)[0]?.props?.style)?.width).toBe((encodeCode128(CODE) ?? [])[0]);
  });

  it('treats a missing or broken layout width as not measured yet — never a NaN width', () => {
    const tree = draw(<Code128Barcode value={CODE} />);
    [Number.NaN, -10, undefined].forEach(width => {
      act(() => {
        box(tree)?.props?.onLayout?.({ nativeEvent: { layout: { width } } });
      });
      expect(elements(tree)).toHaveLength(0);
    });
    act(() => {
      box(tree)?.props?.onLayout?.({});
    });
    expect(elements(tree)).toHaveLength(0);
  });

  it('draws nothing from a value that is not a code, without throwing', () => {
    [undefined, null, Number.NaN, { code: CODE } as unknown as string].forEach(value => {
      const tree = draw(<Code128Barcode value={value} fallback={<Text>text instead</Text>} />);
      expect(tree.root.findAllByType(Text)).toHaveLength(1);
      act(() => tree.unmount());
      renderer = undefined;
    });
    // A number is a code: its digits.
    const numeric = draw(<Code128Barcode value={20261017} />);
    expect(box(numeric)?.props?.accessibilityLabel).toBe('20261017');
  });

  it('shows the fallback for a code it cannot draw', () => {
    const tree = draw(<Code128Barcode value="প্রেসক্রিপশন" fallback={<Text>text instead</Text>} />);
    expect(tree.root.findAllByType(Text).map(node => node.props.children)).toEqual(['text instead']);
    expect(box(tree)).toBeUndefined();

    act(() => tree.unmount());
    renderer = undefined;
    expect(draw(<Code128Barcode value="" />).toJSON()).toBeNull();
  });
});
