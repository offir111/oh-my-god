/**
 * feedScheduler.js
 * Generates virtual blog posts on a round-robin schedule (every 2 days).
 * On first boot, generates an initial batch of posts if none exist.
 */

import { generateNextVirtualPost } from './virtualPostGenerator.js';
import { store } from '../store/memory.js';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const INITIAL_BATCH_SIZE = 8; // generate this many posts on first boot

/**
 * Starts the feed scheduler.
 * - Generates INITIAL_BATCH_SIZE posts on boot if store is empty.
 * - Then schedules a new post every 2 days.
 */
export async function startFeedScheduler() {
  // Generate initial batch if no virtual posts exist yet
  if (store.virtualPosts.length === 0) {
    console.log(`[virtual-feed] No posts found — generating initial batch of ${INITIAL_BATCH_SIZE}...`);
    for (let i = 0; i < INITIAL_BATCH_SIZE; i++) {
      await generateNextVirtualPost();
      // Small delay between API calls to avoid rate-limiting
      if (i < INITIAL_BATCH_SIZE - 1) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }
    console.log(`[virtual-feed] Initial batch done — ${store.virtualPosts.length} posts generated`);
  } else {
    console.log(`[virtual-feed] ${store.virtualPosts.length} posts already in store — skipping initial batch`);
  }

  // Schedule one new post every 2 days
  setInterval(async () => {
    console.log('[virtual-feed] ⏰ scheduler tick — generating new post');
    await generateNextVirtualPost();
  }, TWO_DAYS_MS);

  console.log('[virtual-feed] scheduler started (interval: 2 days)');
}
