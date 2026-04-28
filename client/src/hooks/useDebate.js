import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { useAppStore } from '../store/appStore.js';

export function useDebate(debateId) {
  const { addTextMessage, addVoiceMessage, setPhase, setTurn,
          updateScore, setSpectatorCount, addGift,
          setStreamingMessage, appendStreamingChunk, clearStreamingMessage } = useAppStore();
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentRecording, setOpponentRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finishData, setFinishData] = useState(null);
  const [disconnected, setDisconnected] = useState(false);
  const fallbackStreamIntervalsRef = useRef(new Set());

  useEffect(() => {
    if (!debateId) return;

    function onTextMessageReceived(msg) {
      setOpponentTyping(false);
      // Simulate streaming animation for AI messages (works even with old server)
      if (msg.isAI && msg.content) {
        const fullText = msg.content;
        let i = 0;
        setStreamingMessage({ side: msg.side, content: '', isAI: true, timestamp: msg.timestamp });
        const interval = setInterval(() => {
          i += 3;
          if (i >= fullText.length) {
            clearInterval(interval);
            fallbackStreamIntervalsRef.current.delete(interval);
            clearStreamingMessage();
            addTextMessage(msg);
          } else {
            appendStreamingChunk(fullText.slice(i - 3, i));
          }
        }, 10125); // Another 50% slower for a near-reading typing pace
        fallbackStreamIntervalsRef.current.add(interval);
      } else {
        addTextMessage(msg);
      }
    }

    function onVoiceMessageReceived(msg) {
      addVoiceMessage(msg);
      setOpponentRecording(false);
    }

    function onTurnChanged({ turn }) {
      setTurn(turn);
    }

    function onAITyping() {
      setOpponentTyping(true);
    }

    function onAIStreamStart({ side }) {
      console.log('[stream] START', side);
      setOpponentTyping(false);
      setStreamingMessage({ side, content: '', isAI: true, timestamp: Date.now() });
    }

    function onAIStreamChunk({ chunk }) {
      console.log('[stream] CHUNK', chunk.length, 'chars:', chunk.substring(0, 30));
      appendStreamingChunk(chunk);
    }

    function onAIStreamEnd({ msg }) {
      console.log('[stream] END', msg.content.length, 'chars');
      clearStreamingMessage();
      addTextMessage(msg);
    }

    function onAIStreamError() {
      console.log('[stream] ERROR');
      clearStreamingMessage();
    }

    function onOpponentRecording() {
      setOpponentRecording(true);
    }

    function onOpponentStopped() {
      setOpponentRecording(false);
    }

    function onPhaseChanged({ phase }) {
      setPhase(phase);
      setOpponentTyping(false);
      setOpponentRecording(false);
    }

    function onDebateFinished(data) {
      setFinished(true);
      setFinishData(data);
    }

    function onScoreUpdated({ newScore }) {
      updateScore(newScore);
    }

    function onSpectatorCountUpdated({ count }) {
      setSpectatorCount(count);
    }

    function onGiftReceived(gift) {
      addGift(gift);
    }

    function onOpponentDisconnected() {
      setDisconnected(true);
    }

    socket.on('TEXT_MESSAGE_RECEIVED', onTextMessageReceived);
    socket.on('VOICE_MESSAGE_RECEIVED', onVoiceMessageReceived);
    socket.on('TURN_CHANGED', onTurnChanged);
    socket.on('AI_TYPING', onAITyping);
    socket.on('AI_STREAM_START', onAIStreamStart);
    socket.on('AI_STREAM_CHUNK', onAIStreamChunk);
    socket.on('AI_STREAM_END', onAIStreamEnd);
    socket.on('AI_STREAM_ERROR', onAIStreamError);
    socket.on('OPPONENT_RECORDING', onOpponentRecording);
    socket.on('OPPONENT_STOPPED', onOpponentStopped);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('DEBATE_FINISHED', onDebateFinished);
    socket.on('SCORE_UPDATED', onScoreUpdated);
    socket.on('SPECTATOR_COUNT_UPDATED', onSpectatorCountUpdated);
    socket.on('GIFT_RECEIVED', onGiftReceived);
    socket.on('OPPONENT_DISCONNECTED', onOpponentDisconnected);

    return () => {
      for (const interval of fallbackStreamIntervalsRef.current) clearInterval(interval);
      fallbackStreamIntervalsRef.current.clear();
      clearStreamingMessage();
      socket.off('TEXT_MESSAGE_RECEIVED', onTextMessageReceived);
      socket.off('VOICE_MESSAGE_RECEIVED', onVoiceMessageReceived);
      socket.off('TURN_CHANGED', onTurnChanged);
      socket.off('AI_TYPING', onAITyping);
      socket.off('AI_STREAM_START', onAIStreamStart);
      socket.off('AI_STREAM_CHUNK', onAIStreamChunk);
      socket.off('AI_STREAM_END', onAIStreamEnd);
      socket.off('AI_STREAM_ERROR', onAIStreamError);
      socket.off('OPPONENT_RECORDING', onOpponentRecording);
      socket.off('OPPONENT_STOPPED', onOpponentStopped);
      socket.off('PHASE_CHANGED', onPhaseChanged);
      socket.off('DEBATE_FINISHED', onDebateFinished);
      socket.off('SCORE_UPDATED', onScoreUpdated);
      socket.off('SPECTATOR_COUNT_UPDATED', onSpectatorCountUpdated);
      socket.off('GIFT_RECEIVED', onGiftReceived);
      socket.off('OPPONENT_DISCONNECTED', onOpponentDisconnected);
    };
  }, [debateId]);

  return { opponentTyping, opponentRecording, finished, finishData, disconnected };
}
