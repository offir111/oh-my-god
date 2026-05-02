import { useEffect, useState } from 'react';
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
  useEffect(() => {
    if (!debateId) return;

    function onTextMessageReceived(msg) {
      setOpponentTyping(false);
      const debateNow = useAppStore.getState().debate;
      const aiReply =
        debateNow?.isAI &&
        debateNow.aiSide &&
        msg?.side === debateNow.aiSide;
      addTextMessage(aiReply ? { ...msg, isAI: true } : msg);
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

    function onAIStreamEnd(payload) {
      const msg = payload?.msg;
      const { streamingMessage, debate } = useAppStore.getState();
      const streamText = String(streamingMessage?.content || '').trim();
      const serverText = typeof msg?.content === 'string' ? msg.content.trim() : '';
      const content = serverText || streamText;
      const side = msg?.side || debate?.aiSide;
      const timestamp = typeof msg?.timestamp === 'number' ? msg.timestamp : Date.now();
      console.log('[stream] END', content.length, 'chars (server:', serverText.length, 'local:', streamText.length, ')');
      clearStreamingMessage();
      if (!content || !side) return;
      addTextMessage({ side, content, timestamp, isAI: true });
    }

    function onAIStreamError() {
      console.log('[stream] ERROR');
      clearStreamingMessage();
      const { debate } = useAppStore.getState();
      const side = debate?.aiSide;
      if (side) {
        addTextMessage({
          side,
          content: '⚠️ השרת לא הצליח לייצר תשובה כרגע. נסה שוב.',
          timestamp: Date.now(),
          isAI: true,
          isError: true,
        });
      }
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
