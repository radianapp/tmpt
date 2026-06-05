// TMPT integrations wrapper
import { detectContentType } from './content-detector.js';

export function checkIncomingContext() {
  const params = new URLSearchParams(window.location.search);
  const context = params.get('context');
  const sourceUrl = params.get('url');

  if (context === 'forms' && sourceUrl) {
    // We came from TMPT Forms
    return {
      type: 'url',
      data: {
        url: sourceUrl,
        title: params.get('title') || 'Form QR'
      }
    };
  }

  // Generic ID to load
  const id = params.get('id');
  if (id) {
    return { load_id: id };
  }

  return null;
}
