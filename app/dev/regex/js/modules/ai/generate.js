// app/dev/regex/js/modules/ai/generate.js

export async function generateRegex(prompt) {
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
      'dangerously-allow-browser': 'true' // Diperlukan untuk pemanggilan langsung dari browser
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Anda adalah asisten AI teknis. Buat regex berdasarkan deskripsi berikut: "${prompt}".
Tanggapi HANYA dengan format JSON valid berikut tanpa markdown apa pun:
{
  "pattern": "pola_regex_tanpa_slash",
  "flags": "flags_seperti_g_atau_i",
  "explanation": "Penjelasan singkat dalam Bahasa Indonesia",
  "examples": ["contoh_cocok_1", "contoh_cocok_2"]
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
  
  // Parse JSON dari respons
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error('Gagal memproses respon dari AI: ' + text);
  }
}
