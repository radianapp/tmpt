// Health check utility for QR URL contents

export async function checkQRHealth(qrContent) {
  const result = {
    is_url: false,
    reachable: false,
    ssl: false,
    status: null,
    error_message: null
  };

  const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
  if (!urlRegex.test(qrContent.trim())) {
    return result;
  }

  result.is_url = true;
  result.ssl = qrContent.toLowerCase().startsWith('https://');

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

    // HEAD request is lightweight
    const resp = await fetch(qrContent, {
      method: 'HEAD',
      mode: 'no-cors', // handle CORS gracefully by returning opaque response
      signal: controller.signal
    });

    clearTimeout(id);
    result.reachable = true;
    result.status = resp.status || 'Reachable (Opaque)';
  } catch (err) {
    // If HEAD failed or CORS was strict, try GET
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(qrContent, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(id);
      result.reachable = true;
      result.status = resp.status || 'Reachable (Opaque)';
    } catch (err2) {
      result.reachable = false;
      result.error_message = err2.name === 'AbortError' ? 'Koneksi Timeout' : err2.message;
    }
  }

  return result;
}
