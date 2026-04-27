import { useEffect, useState } from 'react';
import { socket } from '../socket.js';
import { useAppStore } from '../store/appStore.js';

export function useDebate(debateId) {
  const { addTextMessage, addVoiceMessage, setPhase, setTurn,
          updateScore, setSpectatorCount, addGift, debate,
          setStreamingMessage, appendStreamingChunk, clearStreamingMessage } = useAppStore();
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentRecording, setOpponentRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finishData, setFinishData] = useState(null);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    if (!debateId) return;

    socket.on('TEXT_MESSAGE_RECEIVED', (msg) => {
      setOpponentTyping(false);
      // Simulate streaming animation for AI messages (works even with old server)
      if (msg.isAI && msg.content) {
        const fullText = msg.content;
        let i = 0;
        setStreamingMessage({ side: msg.side, content: '', isAI: true, timestamp: msg.timestamp });
        const interval = setInterval(() => {
          i += 3; // add 3 chars at a time for fast typing effect
          if (i >= fullText.length) {
            clearInterval(interval);
            clearStreamingMessage();
            addTextMessage(msg);
          } else {
            appendStreamingChunk(fullText.slice(i - 3, i));
          }
        }, 900); // ~900ms per chunk = extremely slow typing speed
      } else {
        addTextMessage(msg);
      }
    });

    socket.on('VOICE_MESSAGE_RECEIVED', (msg) => {
      addVoiceMessage(msg);
      setOpponentRecording(false);
    });

    socket.on('TURN_CHANGED', ({ turn }) => setTurn(turn));

    socket.on('AI_TYPING', () => setOpponentTyping(true));

    socket.on('AI_STREAM_START', ({ side }) => {
      console.log('[stream] START', side);
      setOpponentTyping(false);
      setStreamingMessage({ side, content: '', isAI: true, timestamp: Date.now() });
    });
    socket.on('AI_STREAM_CHUNK', ({ chunk }) => {
      console.log('[stream] CHUNK', chunk.length, 'chars:', chunk.substring(0, 30));
      appendStreamingChunk(chunk);
    });
    socket.on('AI_STREAM_END', ({ msg }) => {
      console.log('[stream] END', msg.content.length, 'chars');
      clearStreamingMessage();
      addTextMessage(msg);
    });
    socket.on('AI_STREAM_ERROR', () => {
      console.log('[stream] ERROR');
      clearStreamingMessage();
    });

    socket.on('OPPONENT_RECORDING', () => setOpponentRecording(true));
    socket.on('OPPONENT_STOPPED', () => setOpponentRecording(false));

    socket.on('PHASE_CHANGED', ({ phase }) => {
      setPhase(phase);
      setOpponentTyping(false);
      setOpponentRecording(false);
    });

    socket.on('DEBATE_FINISHED', (data) => {
      setFinished(true);
      setFinishData(data);
    });

    socket.on('SCORE_UPDATED', ({ newScore }) => updateScore(newScore));

    socket.on('SPECTATOR_COUNT_UPDATED', ({ count }) => setSpectatorCount(count));

    socket.on('GIFT_RECEIVED', (gift) => addGift(gift));

    socket.on('OPPONENT_DISCONNECTED', () => setDisconnected(true));

    return () => {
      socket.off('TEXT_MESSAGE_RECEIVED');
      socket.off('VOICE_MESSAGE_RECEIVED');
      socket.off('TURN_CHANGED');
      socket.off('AI_TYPING');
      socket.off('AI_STREAM_START');
      socket.off('AI_STREAM_CHUNK');
      socket.off('AI_STREAM_END');
      socket.off('AI_STREAM_ERROR');
      socket.off('OPPONENT_RECORDING');
      socket.off('OPPONENT_STOPPED');
      socket.off('PHASE_CHANGED');
      socket.off('DEBATE_FINISHED');
      socket.off('SCORE_UPDATED');
      socket.off('SPECTATOR_COUNT_UPDATED');
      socket.off('GIFT_RECEIVED');
      socket.off('OPPONENT_DISCONNECTED');
    };
  }, [debateId]);

  return { opponentTyping, opponentRecording, finished, finishData, disconnected };
}
