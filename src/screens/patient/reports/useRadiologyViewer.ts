import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { AlphaType, ColorType, Skia, SkImage } from '@shopify/react-native-skia';
import {
  MedicalRecordRepository,
  PackedFrame,
  RadiologyFrame,
  RadiologySeries,
  RadiologyStudy,
  WindowLevel,
  canWindow,
  defaultWindow,
  packFrame,
  serverMessageOf,
  valueAt,
} from '@app/core';

export type RadiologyViewerStatus = 'loading' | 'ready' | 'empty' | 'failed';

/** A frame ready to draw. */
export interface LoadedFrame {
  image: SkImage;
  /**
   * Drawn from its stored pixels through the window shader — a grey frame. A colour frame,
   * or one the PACS could not send uncompressed, is drawn from its rendered JPEG instead.
   */
  isWindowed: boolean;
  /** Lowest and highest value in a windowed frame, after Rescale — for the window presets. */
  range: { min: number; max: number } | null;
}

/**
 * A cached frame, with the stored values of a windowed one. Those stay here, behind
 * `probeValue`, and never go into a React prop: React's dev renderer walks every changed prop
 * for its performance track, and a frame's 1 MB of texels walked one by one is seconds per
 * render in a debug build.
 */
interface CacheEntry {
  loaded: LoadedFrame;
  packed: PackedFrame | null;
}

/** Cine speed — frames per second, about what a radiologist scrolls at. */
const CINE_FPS = 10;
/** Frames fetched ahead of the one shown, so scrolling and cine don't wait. */
const PREFETCH_AHEAD = 4;
/**
 * Decoded frames kept in memory, in bytes. A CT slice is ~1 MB, a digital X-ray up to ~40 MB.
 * ponytail: a plain byte budget, oldest out first; tune it if big X-ray studies run phones dry.
 */
const CACHE_BUDGET = 160 * 1024 * 1024;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Status of a failed request — axios keeps it on `response`. */
const statusOf = (error: any): number => Number(error?.response?.status ?? error?.status ?? 0);

/** A series' frame for its thumbnail — the middle one, the most typical of a stack. */
const thumbnailFrameOf = (series?: RadiologySeries | null): RadiologyFrame | undefined =>
  series?.frames?.[Math.floor((series?.frames?.length ?? 0) / 2)];

const imageFromJpeg = (bytes: Uint8Array): SkImage => {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) throw new Error('Unreadable image');
  return image;
};

/** Stored pixels → an RGBA image the window shader unpacks. */
const imageFromPixels = (pixels: Uint8Array, frame: RadiologyFrame): CacheEntry => {
  const packed = packFrame(pixels, frame.info);
  const { columns, rows } = frame.info;
  const image = Skia.Image.MakeImage(
    { width: columns, height: rows, alphaType: AlphaType.Opaque, colorType: ColorType.RGBA_8888 },
    Skia.Data.fromBytes(packed.rgba),
    columns * 4,
  );
  if (!image) throw new Error('Could not build the frame');
  return { loaded: { image, isWindowed: true, range: { min: packed.min, max: packed.max } }, packed };
};

/**
 * One radiology test as DICOM: the viewer link comes from HMS, the series and their frames
 * from the PACS. A grey frame is read as its stored pixels — the screen windows them itself,
 * reads Hounsfield units and measures in millimetres; a colour frame is the PACS's JPEG.
 * The link's token is short-lived, so a refused request asks once for a fresh link and keeps
 * the place in the stack.
 */
export const useRadiologyViewer = (billRowId: number) => {
  const [status, setStatus] = useState<RadiologyViewerStatus>('loading');
  const [message, setMessage] = useState('');
  const [study, setStudy] = useState<RadiologyStudy | null>(null);
  const [seriesIndex, setSeriesIndex] = useState(0);
  const [sliceIndex, setSliceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  /** Bumped when a frame arrives — the cache itself lives in refs. */
  const [cacheVersion, frameArrived] = useReducer((count: number) => count + 1, 0);
  /** Key (pixel or rendered URL) → decoded frame. Map order is age: the oldest goes first. */
  const cacheRef = useRef(new Map<string, CacheEntry>());
  const cacheBytesRef = useRef(0);
  const pendingRef = useRef(new Set<string>());
  /** Frames the PACS would not send uncompressed — they are drawn from its JPEG instead. */
  const jpegOnlyRef = useRef(new Set<string>());
  /** Series UID → the window its first frame came with; kept as the series' "Default". */
  const baseWindowsRef = useRef(new Map<string, WindowLevel>());
  /** Set once a request was refused and a fresh link asked for; cleared by the next frame that arrives. */
  const retriedRef = useRef(false);

  const series = useMemo(() => study?.series ?? [], [study]);
  const current = series[seriesIndex] ?? null;
  const sliceCount = current?.frames?.length ?? 0;
  const frame = current?.frames?.[sliceIndex] ?? null;
  const token = study?.token ?? '';

  const load = useCallback(async () => {
    setStatus('loading');
    setIsPlaying(false);
    try {
      const images = await MedicalRecordRepository.getRadiologyImages(billRowId);
      if (!images?.found) {
        setMessage(images?.message ?? '');
        setStatus('empty');
        return;
      }
      const next = await MedicalRecordRepository.getRadiologyStudy(images?.viewerUrl ?? '');
      setStudy(next);
      setStatus(next?.series?.length ? 'ready' : 'empty');
    } catch (error: any) {
      console.log('radiology viewer error ==>', error?.message);
      setMessage(serverMessageOf(error) ?? '');
      setStatus('failed');
    }
  }, [billRowId]);

  useEffect(() => {
    load();
  }, [load]);

  // Decoded frames hold native memory; let it go with the screen.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.forEach(item => item?.loaded?.image?.dispose?.());
      cache.clear();
    };
  }, []);

  /** A refused request means the token ran out: ask once for a fresh link, then give up. */
  const onRefused = useCallback(() => {
    if (retriedRef.current) {
      setIsPlaying(false);
      setStatus('failed');
      return;
    }
    retriedRef.current = true;
    load();
  }, [load]);

  const store = useCallback((key: string, entry: CacheEntry, bytes: number) => {
    const cache = cacheRef.current;
    cache.set(key, entry);
    cacheBytesRef.current += bytes;
    for (const [oldKey, old] of cache) {
      if (cacheBytesRef.current <= CACHE_BUDGET || oldKey === key) break;
      cache.delete(oldKey);
      old?.loaded?.image?.dispose?.();
      cacheBytesRef.current -= (old?.loaded?.image?.width() ?? 0) * (old?.loaded?.image?.height() ?? 0) * 4;
    }
    retriedRef.current = false;
    frameArrived();
  }, []);

  /** Keys a frame is cached under: its pixels, or its JPEG when it is drawn from that. */
  const keyOf = useCallback(
    (item?: RadiologyFrame | null): string =>
      !item ? '' : canWindow(item.info) && !jpegOnlyRef.current.has(item.pixelUrl) ? item.pixelUrl : item.renderedUrl,
    [],
  );

  const fetchFrame = useCallback(
    (item?: RadiologyFrame | null, seriesUid?: string, asJpeg = false) => {
      const key = asJpeg ? item?.renderedUrl ?? '' : keyOf(item);
      if (!item || !key || !token || cacheRef.current.has(key) || pendingRef.current.has(key)) return;
      pendingRef.current.add(key);
      const isPixels = key === item.pixelUrl;

      const request = isPixels
        ? MedicalRecordRepository.getRadiologyFramePixels(key, token).then(pixels => {
            const entry = imageFromPixels(pixels, item);
            if (seriesUid && entry.packed && !baseWindowsRef.current.has(seriesUid)) {
              baseWindowsRef.current.set(seriesUid, defaultWindow(item.info, entry.packed));
            }
            store(key, entry, item.info.rows * item.info.columns * 4);
          })
        : MedicalRecordRepository.getRadiologyRenderedFrame(key, token).then(bytes => {
            const image = imageFromJpeg(bytes);
            const entry: CacheEntry = { loaded: { image, isWindowed: false, range: null }, packed: null };
            store(key, entry, image.width() * image.height() * 4);
          });

      request
        .catch((error: any) => {
          console.log('radiology frame error ==>', statusOf(error), error?.message);
          if (statusOf(error) === 403) {
            onRefused();
          } else if (isPixels) {
            // The PACS could not transcode it (an unusual compression): its JPEG still shows it.
            jpegOnlyRef.current.add(item.pixelUrl);
            frameArrived();
          }
        })
        .finally(() => pendingRef.current.delete(key));
    },
    [keyOf, token, store, onRefused],
  );

  // The frame shown, its neighbours, and one frame per series for the strip.
  // ponytail: no queue — a fast drag through a long CT stack starts many requests at once; add
  // a small concurrency limit if that ever chokes a slow link.
  useEffect(() => {
    if (status !== 'ready') return;
    const frames = current?.frames ?? [];
    [sliceIndex, sliceIndex - 1, ...Array.from({ length: PREFETCH_AHEAD }, (_, i) => sliceIndex + 1 + i)]
      .forEach(index => fetchFrame(frames[index], current?.uid));
    // Thumbnails are the PACS's JPEGs: small, and already windowed.
    series.forEach(item => fetchFrame(thumbnailFrameOf(item), item?.uid, true));
  }, [status, current, sliceIndex, series, fetchFrame, cacheVersion]);

  // A reload can bring fewer series or frames — keep the place, but inside the stack.
  useEffect(() => {
    setSeriesIndex(index => clamp(index, 0, Math.max(series.length - 1, 0)));
  }, [series.length]);
  useEffect(() => {
    setSliceIndex(index => clamp(index, 0, Math.max(sliceCount - 1, 0)));
  }, [sliceCount]);

  useEffect(() => {
    if (!isPlaying || sliceCount < 2) return;
    const timer = setInterval(() => setSliceIndex(index => (index + 1) % sliceCount), 1000 / CINE_FPS);
    return () => clearInterval(timer);
  }, [isPlaying, sliceCount]);

  const selectSeries = useCallback((index: number) => {
    setIsPlaying(false);
    setSeriesIndex(index);
    setSliceIndex(0);
  }, []);

  /** Moves to a slice — by drag or button; past either end it stops there. */
  const goToSlice = useCallback(
    (index: number) => setSliceIndex(clamp(Math.round(index), 0, Math.max(sliceCount - 1, 0))),
    [sliceCount],
  );

  const togglePlay = useCallback(() => setIsPlaying(playing => !playing), []);

  /** The full PACS viewer (MPR, more tools) in the browser, with a fresh link. */
  const openInBrowser = useCallback(async () => {
    const images = await MedicalRecordRepository.getRadiologyImages(billRowId);
    const viewerUrl = images?.viewerUrl?.trim() ?? '';
    if (!/^https?:\/\//i.test(viewerUrl)) throw new Error('Unexpected images link');
    await Linking.openURL(viewerUrl);
  }, [billRowId]);

  /** The value under a pixel of the shown frame — Hounsfield units on CT; null off the frame, or on a JPEG. */
  const probeValue = useCallback(
    (x: number, y: number): number | null => {
      const packed = cacheRef.current.get(keyOf(frame))?.packed;
      return packed && frame ? valueAt(packed, frame.info, x, y) : null;
    },
    [frame, keyOf],
  );

  return {
    status,
    message,
    series,
    seriesIndex,
    current,
    frame,
    /** The shown frame, decoded; null while it is still on its way. */
    loaded: cacheRef.current.get(keyOf(frame))?.loaded ?? null,
    probeValue,
    /** The window the current series opened with — its "Default" preset. */
    baseWindow: current ? baseWindowsRef.current.get(current.uid) ?? null : null,
    thumbnailOf: (item: RadiologySeries): SkImage | null =>
      cacheRef.current.get(thumbnailFrameOf(item)?.renderedUrl ?? '')?.loaded?.image ?? null,
    sliceIndex,
    sliceCount,
    isPlaying,
    load,
    selectSeries,
    goToSlice,
    togglePlay,
    openInBrowser,
  };
};

export default useRadiologyViewer;
