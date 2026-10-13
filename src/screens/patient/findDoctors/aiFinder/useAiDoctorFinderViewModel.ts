import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  AiAssistFailure,
  AiDoctorFinderRepository,
  AiDoctorMatch,
  AiFinderTurn,
  SpeechToTextRepository,
  aiAssistErrorMessage,
  aiAssistFailureOf,
} from '@app/core';
import {
  RecorderFailure,
  deleteRecording,
  useVoiceRecorder,
} from '../../../../hooks/useVoiceRecorder';

/**
 * The AI doctor finder on Find Doctors, as the portal has it: the patient types
 * or says how they feel, AI names the specialist to see and puts forward
 * doctors from this hospital, one of them as the best match.
 *
 * A search can go on: what the patient adds next ("a female doctor, please")
 * goes up with the earlier turns, so the AI refines its pick rather than
 * starting over. Starting a new search drops them.
 */

export type AiFinderPhase = 'idle' | 'recording' | 'transcribing' | 'thinking';

export type AiFinderNotice = AiAssistFailure | RecorderFailure;

/** Long enough to describe symptoms; past it the recording stops and is sent. */
export const MAX_SYMPTOM_RECORDING_MS = 60_000;

/** Too short to hold a sentence — a slip of the thumb, not a description. */
export const MIN_SYMPTOM_RECORDING_MS = 800;

/** Not a secret or an identifier — it only keeps one search's turns together on pepobot's side. */
const newSessionId = (): string =>
  `find-doctor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const useAiDoctorFinderViewModel = () => {
  const recorder = useVoiceRecorder();
  const {
    start: startRecorder,
    stop: stopRecorder,
    discard: discardRecording,
    isActive: isRecorderActive,
  } = recorder;

  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<AiFinderPhase>('idle');
  const [match, setMatch] = useState<AiDoctorMatch | null>(null);
  /** What was asked last, shown back above the answer. */
  const [asked, setAsked] = useState('');
  const [notice, setNoticeState] = useState<AiFinderNotice | null>(null);
  /** What the service itself said when it turned the ask down; '' when nothing. */
  const [noticeMessage, setNoticeMessage] = useState('');

  const historyRef = useRef<AiFinderTurn[]>([]);
  const sessionIdRef = useRef(newSessionId());
  const requestRef = useRef<AbortController | null>(null);
  /** Bumped by every cancel and reset, so work they overtook drops its result. */
  const flowRef = useRef(0);
  const isStoppingRef = useRef(false);

  const setNotice = useCallback((next: AiFinderNotice | null, message = '') => {
    setNoticeState(next);
    setNoticeMessage(message);
  }, []);

  // Leaving the screen stops whatever is on its way.
  useEffect(() => () => requestRef.current?.abort(), []);

  /**
   * Sends the patient's words — typed, picked from an example, or heard in a
   * recording — together with the turns before them.
   */
  const ask = useCallback(
    async (words: string, signal: AbortSignal, flow: number) => {
      setPhase('thinking');
      setAsked(words);

      try {
        const answer = await AiDoctorFinderRepository.findDoctors({
          text: words,
          history: historyRef.current,
          sessionId: sessionIdRef.current,
          signal,
        });
        if (signal.aborted || flow !== flowRef.current) return;

        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: words },
          ...(answer?.message ? [{ role: 'assistant' as const, content: answer.message }] : []),
        ];
        setMatch(answer);
        setInput('');
      } catch (error) {
        if (signal.aborted || flow !== flowRef.current) return;

        console.log('[FindDoctors] AI doctor finder', error);
        setNotice(aiAssistFailureOf(error), aiAssistErrorMessage(error));
      } finally {
        if (flow === flowRef.current) setPhase('idle');
      }
    },
    [setNotice],
  );

  /** A fresh request for this flow, replacing any still on its way. */
  const beginRequest = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    return request;
  }, []);

  /** Typed words, or an example the patient tapped. */
  const submit = useCallback(
    (text?: string) => {
      const words = (text ?? input).trim();
      if (!words || phase !== 'idle') return;

      setNotice(null);
      ask(words, beginRequest().signal, flowRef.current);
    },
    [input, phase, ask, beginRequest, setNotice],
  );

  // ── Voice ──────────────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    if (phase !== 'idle') return;
    setNotice(null);

    const result = await startRecorder();
    // A second tap, or the screen left while the permission prompt was up.
    if (result === 'ignored') return;
    if (result !== 'started') {
      setNotice(result);
      return;
    }
    setPhase('recording');
  }, [phase, startRecorder, setNotice]);

  /** Stops listening and throws the recording away — nothing is sent. */
  const cancelVoice = useCallback(async () => {
    flowRef.current += 1;
    await discardRecording();
    setPhase('idle');
  }, [discardRecording]);

  /**
   * Stops listening, turns the recording into words and asks with them — after
   * anything already typed, so a patient can start typing and finish speaking.
   */
  const stopVoice = useCallback(async () => {
    if (isStoppingRef.current || !isRecorderActive()) return;
    isStoppingRef.current = true;
    const flow = flowRef.current;

    const recording = await stopRecorder().finally(() => {
      isStoppingRef.current = false;
    });

    // Cancelled, or the screen left, while the recorder was still stopping.
    if (flow !== flowRef.current) {
      await deleteRecording(recording?.uri);
      return;
    }
    if (!recording?.uri) {
      setNotice('recordFailed');
      setPhase('idle');
      return;
    }

    const request = beginRequest();
    setPhase('transcribing');

    let heard = '';
    try {
      heard = await SpeechToTextRepository.transcribe(
        recording,
        recording?.durationMs ?? 0,
        request.signal,
      );
    } catch (error) {
      if (request.signal.aborted || flow !== flowRef.current) return;

      console.log('[FindDoctors] transcribe symptoms', error);
      setNotice(aiAssistFailureOf(error), aiAssistErrorMessage(error));
      setPhase('idle');
      return;
    } finally {
      // Heard, cancelled or failed — either way the recording leaves the phone.
      await deleteRecording(recording?.uri);
    }
    if (request.signal.aborted || flow !== flowRef.current) return;

    const typed = input.trim();
    ask(typed ? `${typed} ${heard}` : heard, request.signal, flow);
  }, [isRecorderActive, stopRecorder, beginRequest, input, ask, setNotice]);

  // The recording has a ceiling, and reaching it sends what was said.
  useEffect(() => {
    if (phase === 'recording' && recorder.elapsedMs >= MAX_SYMPTOM_RECORDING_MS) stopVoice();
  }, [phase, recorder.elapsedMs, stopVoice]);

  /*
   * Leaving the screen — a doctor's details, another tab — throws a recording
   * still running away: the tab stays mounted, so without this the mic would
   * keep listening behind the other screen and send what it heard at the
   * ceiling. Held in a ref so the listener is set up once.
   */
  const cancelVoiceRef = useRef(cancelVoice);
  cancelVoiceRef.current = cancelVoice;

  useFocusEffect(
    useCallback(
      () => () => {
        if (isRecorderActive()) cancelVoiceRef.current();
      },
      [isRecorderActive],
    ),
  );

  /** Stops an ask on its way — transcribing or thinking — and keeps what was typed. */
  const cancelAsk = useCallback(() => {
    flowRef.current += 1;
    requestRef.current?.abort();
    setPhase('idle');
  }, []);

  /** A new search: the answer, the earlier turns and any notice all go. */
  const reset = useCallback(() => {
    flowRef.current += 1;
    requestRef.current?.abort();
    historyRef.current = [];
    sessionIdRef.current = newSessionId();
    setMatch(null);
    setAsked('');
    setInput('');
    setNotice(null);
    setPhase('idle');
  }, [setNotice]);

  return {
    input,
    setInput,
    phase,
    match,
    asked,
    notice,
    noticeMessage,
    submit,
    startVoice,
    stopVoice,
    cancelVoice,
    cancelAsk,
    reset,
    recordingMs: recorder.elapsedMs,
    recordingLevels: recorder.levels,
    isRecordingSilent: recorder.isSilent,
  };
};

export type AiDoctorFinderViewModel = ReturnType<typeof useAiDoctorFinderViewModel>;
