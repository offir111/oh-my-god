import { useEffect } from 'react';
import { useAppStore } from '../store/appStore.js';

export function useGifts() {
  const gifts = useAppStore(s => s.gifts);
  const removeGift = useAppStore(s => s.removeGift);

  useEffect(() => {
    if (gifts.length === 0) return;
    const latest = gifts[gifts.length - 1];
    const timer = setTimeout(() => removeGift(latest.uid), 2000);
    return () => clearTimeout(timer);
  }, [gifts.length]);

  return gifts;
}
