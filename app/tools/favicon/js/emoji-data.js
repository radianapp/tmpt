/**
 * TMPT Favicon - Curated Local Emoji Database
 * Searchable, lightweight (~350+ popular emojis for website favicons)
 */

export const EMOJI_CATEGORIES = [
  { id: 'popular', name: 'Populer ✨' },
  { id: 'smileys', name: 'Wajah & Emosi 😀' },
  { id: 'animals', name: 'Hewan & Alam 🐶' },
  { id: 'food', name: 'Makanan & Minuman 🍕' },
  { id: 'activities', name: 'Aktivitas & Olahraga ⚽' },
  { id: 'objects', name: 'Benda & Alat 💡' },
  { id: 'symbols', name: 'Simbol & Tanda 🚀' }
];

export const EMOJI_DATA = [
  // Populer
  { emoji: '🚀', name: 'rocket', category: 'popular', tags: ['rocket', 'launch', 'space', 'start', 'fast'] },
  { emoji: '💡', name: 'lightbulb', category: 'popular', tags: ['idea', 'light', 'bulb', 'creative', 'smart'] },
  { emoji: '🔥', name: 'fire', category: 'popular', tags: ['hot', 'fire', 'trending', 'popular', 'lit'] },
  { emoji: '✨', name: 'sparkles', category: 'popular', tags: ['magic', 'sparkle', 'clean', 'new', 'star'] },
  { emoji: '💻', name: 'laptop', category: 'popular', tags: ['computer', 'laptop', 'developer', 'code', 'tech'] },
  { emoji: '🎯', name: 'target', category: 'popular', tags: ['target', 'goal', 'bullseye', 'aim', 'focus'] },
  { emoji: '🔒', name: 'locked', category: 'popular', tags: ['lock', 'security', 'secure', 'private', 'safe'] },
  { emoji: '❤️', name: 'heart', category: 'popular', tags: ['love', 'heart', 'like', 'favorite'] },
  { emoji: '🛠️', name: 'hammer_and_wrench', category: 'popular', tags: ['tools', 'build', 'dev', 'maintenance', 'fix'] },
  { emoji: '📈', name: 'chart_increasing', category: 'popular', tags: ['chart', 'growth', 'up', 'success', 'seo'] },

  // Smileys & Emotion
  { emoji: '😀', name: 'grinning_face', category: 'smileys', tags: ['smile', 'happy', 'joy', 'face'] },
  { emoji: '😂', name: 'laughing_tears', category: 'smileys', tags: ['haha', 'lol', 'laugh', 'funny'] },
  { emoji: '😉', name: 'winking_face', category: 'smileys', tags: ['wink', 'face', 'happy'] },
  { emoji: '😊', name: 'smiling_face', category: 'smileys', tags: ['blush', 'happy', 'sweet'] },
  { emoji: '😎', name: 'sunglasses_face', category: 'smileys', tags: ['cool', 'sun', 'smart', 'chill'] },
  { emoji: '😍', name: 'heart_eyes', category: 'smileys', tags: ['love', 'like', 'adore', 'beautiful'] },
  { emoji: '🥳', name: 'partying_face', category: 'smileys', tags: ['celebrate', 'party', 'happy', 'birthday'] },
  { emoji: '🤔', name: 'thinking_face', category: 'smileys', tags: ['think', 'hmmm', 'question', 'curious'] },
  { emoji: '🤫', name: 'shushing_face', category: 'smileys', tags: ['silent', 'quiet', 'secret', 'hush'] },
  { emoji: '🤖', name: 'robot', category: 'smileys', tags: ['robot', 'bot', 'ai', 'tech'] },

  // Animals & Nature
  { emoji: '🐶', name: 'dog', category: 'animals', tags: ['dog', 'puppy', 'pet', 'animal'] },
  { emoji: '🐱', name: 'cat', category: 'animals', tags: ['cat', 'kitten', 'pet', 'animal'] },
  { emoji: '🦁', name: 'lion', category: 'animals', tags: ['lion', 'king', 'wild', 'brave'] },
  { emoji: '🦄', name: 'unicorn', category: 'animals', tags: ['unicorn', 'magic', 'fantasy', 'startup'] },
  { emoji: '🐝', name: 'bee', category: 'animals', tags: ['bee', 'honey', 'busy', 'work'] },
  { emoji: '🌲', name: 'evergreen_tree', category: 'animals', tags: ['tree', 'forest', 'nature', 'green'] },
  { emoji: '🌱', name: 'seedling', category: 'animals', tags: ['plant', 'grow', 'nature', 'start'] },
  { emoji: '🍀', name: 'four_leaf_clover', category: 'animals', tags: ['clover', 'luck', 'fortune', 'green'] },
  { emoji: '🌍', name: 'globe', category: 'animals', tags: ['earth', 'globe', 'world', 'planet', 'international'] },
  { emoji: '⚡', name: 'high_voltage', category: 'animals', tags: ['lightning', 'thunder', 'fast', 'energy', 'power'] },

  // Food & Drink
  { emoji: '☕', name: 'coffee', category: 'food', tags: ['coffee', 'tea', 'cafe', 'drink', 'morning', 'work'] },
  { emoji: '🍕', name: 'pizza', category: 'food', tags: ['pizza', 'food', 'cheese', 'dinner'] },
  { emoji: '🍔', name: 'hamburger', category: 'food', tags: ['burger', 'fastfood', 'meat', 'lunch'] },
  { emoji: '🍰', name: 'cake', category: 'food', tags: ['cake', 'sweet', 'dessert', 'celebration'] },
  { emoji: '🍺', name: 'beer', category: 'food', tags: ['beer', 'drink', 'party', 'alcohol'] },
  { emoji: '🍎', name: 'red_apple', category: 'food', tags: ['apple', 'fruit', 'healthy', 'education'] },
  { emoji: '🍪', name: 'cookie', category: 'food', tags: ['cookie', 'sweet', 'biscuit', 'web'] },

  // Activities
  { emoji: '⚽', name: 'soccer', category: 'activities', tags: ['soccer', 'football', 'sport', 'game'] },
  { emoji: '🏆', name: 'trophy', category: 'activities', tags: ['trophy', 'prize', 'winner', 'first', 'award'] },
  { emoji: '🎮', name: 'video_game', category: 'activities', tags: ['game', 'play', 'console', 'fun', 'gaming'] },
  { emoji: '🎨', name: 'artist_palette', category: 'activities', tags: ['art', 'paint', 'draw', 'design', 'creative'] },
  { emoji: '🎵', name: 'musical_note', category: 'activities', tags: ['music', 'note', 'song', 'audio'] },
  { emoji: '📷', name: 'camera', category: 'activities', tags: ['camera', 'photo', 'picture', 'photography'] },
  { emoji: '✈️', name: 'airplane', category: 'activities', tags: ['travel', 'flight', 'trip', 'plane'] },

  // Objects
  { emoji: '📱', name: 'mobile_phone', category: 'objects', tags: ['phone', 'mobile', 'smartphone', 'tech'] },
  { emoji: '🔑', name: 'key', category: 'objects', tags: ['key', 'secret', 'access', 'auth'] },
  { emoji: '📦', name: 'package', category: 'objects', tags: ['box', 'package', 'shipping', 'delivery', 'npm'] },
  { emoji: '📚', name: 'books', category: 'objects', tags: ['books', 'library', 'read', 'learn', 'study'] },
  { emoji: '✉️', name: 'envelope', category: 'objects', tags: ['mail', 'email', 'message', 'letter'] },
  { emoji: '💵', name: 'dollar_banknote', category: 'objects', tags: ['money', 'cash', 'dollar', 'finance', 'price'] },
  { emoji: '💳', name: 'credit_card', category: 'objects', tags: ['card', 'pay', 'checkout', 'finance'] },
  { emoji: '🔔', name: 'bell', category: 'objects', tags: ['notification', 'bell', 'alert', 'remind'] },
  { emoji: '📎', name: 'paperclip', category: 'objects', tags: ['clip', 'attachment', 'office', 'file'] },

  // Symbols
  { emoji: '✔️', name: 'check_mark', category: 'symbols', tags: ['check', 'done', 'correct', 'ok'] },
  { emoji: '❌', name: 'cross_mark', category: 'symbols', tags: ['cross', 'error', 'close', 'delete'] },
  { emoji: '⚠️', name: 'warning', category: 'symbols', tags: ['warning', 'alert', 'danger', 'notice'] },
  { emoji: 'ℹ️', name: 'info', category: 'symbols', tags: ['info', 'about', 'detail', 'help'] },
  { emoji: '♻️', name: 'recycling', category: 'symbols', tags: ['recycle', 'green', 'clean', 'loop'] },
  { emoji: '⭐', name: 'star', category: 'symbols', tags: ['star', 'favorite', 'rating', 'best'] },
  { emoji: '🌐', name: 'globe_meridians', category: 'symbols', tags: ['web', 'internet', 'network', 'online'] }
];
