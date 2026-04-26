import { useEffect, useState } from 'react';
import { socket } from '../socket.js';
import { useAppStore } from '../store/appStore.js';

export function useDebate(debateId) {
  const { addTextMessage, addVoiceMessage, setPhase, setTurn,
          updateScore, setSpectatorCount, addGift, debate } = useAppStore();
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentRecording, setOpponentRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finishData, setFinishData] = useState(null);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    if (!debateId) return;

    socket.on('TEXT_MESSAGE_RECEIVED', (msg) => {
      addTextMessage(msg);
      setOpponentTyping(false);
    });

    socket.on('VOICE_MESSAGE_RECEIVED', (msg) => {
      addVoiceMessage(msg);
      setOpponentRecording(false);
    });

    socket.on('TURN_CHANGED', ({ turn }) => setTurn(turn));

    socket.on('AI_TYPING', () => setOpponentTyping(true));

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
