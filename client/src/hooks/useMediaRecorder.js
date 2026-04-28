import { useState, useRef } from 'react';

export function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const mrRef = useRef(null);
  const startTimeRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(100);
      mrRef.current = mr;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setAudioBlob(null);
      return true;
    } catch (e) {
      console.error('Microphone error:', e);
      setError('לא ניתן לגשת למיקרופון. בדוק הרשאות ונסה שוב.');
      return false;
    }
  }

  function stopRecording() {
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      mrRef.current.stop();
      setIsRecording(false);
    }
  }

  function clearBlob() {
    setAudioBlob(null);
    setDuration(0);
    setError('');
  }

  return { isRecording, audioBlob, duration, error, startRecording, stopRecording, clearBlob };
}
