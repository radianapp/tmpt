// app/dev/regex/js/modules/ai/fix.js

export async function fixRegexWithAI(pattern, flags = '') {
  const apiKey = localStorage.getItem('tmpt_regex_ai_key');
  if (!apiKey) {
    throw new Error('API Key belum diatur. Buka "Setelan AI" untuk memasukkan Anthropic API Key Anda.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Periksa pola regular expression berikut untuk masalah performa (termasuk ReDoS), bug, atau simplifikasi: /${pattern}/${flags}.
Tulis rekomendasi perbaikan dalam Bahasa Indonesia.
Berikan pola alternatif yang lebih aman atau cepat jika ada.`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.content[0].text;
}
