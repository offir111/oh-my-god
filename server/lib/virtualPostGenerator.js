/**
 * virtualPostGenerator.js
 * Generates blog posts for virtual users using Groq.
 * Each post is ~40 Hebrew words with a "read more" link to /knowledge.
 */

import Groq from 'groq-sdk';
import { v4 as uuid } from 'uuid';
import { VIRTUAL_USERS } from '../data/virtualUsers.js';
import { chatCompletionWithFallback } from './groqChat.js';
import { store, saveSnapshot } from '../store/memory.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 60_000, maxRetries: 1 });
  }
  return _client;
}

/**
 * Generate a single blog post for the given virtual user.
 * Returns { id, author, displayName, side, title, body, ts, readMoreUrl, isVirtual }
 */
export async function generateVirtualPost(virtualUser) {
  const expertise = virtualUser.expertiseAreas[
    Math.floor(Math.random() * virtualUser.expertiseAreas.length)
  ];

  // Generate body (~40 words, personal tone)
  const bodyRes = await chatCompletionWithFallback(
    getClient(),
    {
      max_tokens: 100,
      messages: [
        { role: 'system', content: virtualUser.systemPrompt },
        {
          role: 'user',
          content: `כתוב פוסט בלוג אישי קצר בדיוק בנושא: "${expertise}".
כ-40 מילים בלבד. גוף ראשון, אישי ואמיתי. ללא כותרת. טקסט רציף בלבד. ללא markdown.`,
        },
      ],
    },
    'virtual-post-body',
  );
  const body = bodyRes.choices[0].message.content.trim();

  // Generate short title (up to 6 words)
  const titleRes = await chatCompletionWithFallback(
    getClient(),
    {
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `תן כותרת קצרה עד 6 מילים לפוסט הזה: "${body.slice(0, 120)}"
כותרת בלבד, ללא ניקוד, ללא מרכאות:`,
        },
      ],
    },
    'virtual-post-title',
  );
  const title = titleRes.choices[0].message.content
    .trim()
    .replace(/^["«»""]|["«»""]$/g, '')
    .trim();

  return {
    id: `vp-${uuid()}`,
    author: virtualUser.username,
    displayName: virtualUser.displayName,
    side: virtualUser.side,
    title: title || expertise,
    body,
    ts: Date.now(),
    readMoreUrl: '/knowledge',
    isVirtual: true,
  };
}

/**
 * Generate the next post in the round-robin sequence and save to store.
 * Advances virtualFeedNextIndex by 1.
 */
export async function generateNextVirtualPost() {
  try {
    const idx = store.virtualFeedNextIndex % VIRTUAL_USERS.length;
    const user = VIRTUAL_USERS[idx];

    console.log(`[virtual-feed] generating post for ${user.username} (idx=${idx})`);
    const post = await generateVirtualPost(user);

    // Prepend (newest first), keep max 100 posts
    store.virtualPosts.unshift(post);
    if (store.virtualPosts.length > 100) {
      store.virtualPosts = store.virtualPosts.slice(0, 100);
    }
    store.virtualFeedNextIndex = (idx + 1) % VIRTUAL_USERS.length;
    saveSnapshot();

    console.log(`[virtual-feed] ✅ post saved: "${post.title}" by ${user.username}`);
    return post;
  } catch (e) {
    console.error('[virtual-feed] generateNextVirtualPost error:', e.message);
    return null;
  }
}
