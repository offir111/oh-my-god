import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore.js';

export function useGifts() {
  const gifts = useAppStore(s => s.gifts);
  const removeGift = useAppStore(s => s.removeGift);
  const timersRef = useRef(new Map());

  useEffect(() => {
    for (const gift of gifts) {
      if (timersRef.current.has(gift.uid)) continue;
      const timer = setTimeout(() => {
        removeGift(gift.uid);
        timersRef.current.delete(gift.uid);
      }, 2000);
      timersRef.current.set(gift.uid, timer);
    }
  }, [gifts, removeGift]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return gifts;
}
