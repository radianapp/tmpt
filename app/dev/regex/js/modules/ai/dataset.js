// app/dev/regex/js/modules/ai/dataset.js

export async function generateDatasetWithAI(pattern, flags = '') {
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
          content: `Hasilkan dataset teks pengujian untuk regular expression /${pattern}/${flags}.
Hasilkan HANYA format JSON valid berikut tanpa markdown apa pun:
{
  "matching": ["contoh_cocok_1", "contoh_cocok_2", "contoh_cocok_3", "contoh_cocok_4", "contoh_cocok_5"],
  "non_matching": ["contoh_salah_1", "contoh_salah_2", "contoh_salah_3", "contoh_salah_4", "contoh_salah_5"]
}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0].text;

  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error('Gagal memproses respon dari AI: ' + text);
  }
}
