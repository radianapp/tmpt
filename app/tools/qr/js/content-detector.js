// Scanned QR content parser & auto-detector

export function detectContentType(content) {
  const c = (content || '').trim();

  if (c.startsWith('WIFI:')) {
    return { type: 'wifi', data: parseWifi(c) };
  }
  if (c.includes('BEGIN:VCARD')) {
    return { type: 'vcard', data: parseVcard(c) };
  }
  if (c.includes('BEGIN:VEVENT')) {
    return { type: 'event', data: parseEvent(c) };
  }
  if (c.startsWith('mailto:')) {
    return { type: 'email', data: parseEmail(c) };
  }
  if (c.startsWith('tel:')) {
    return { type: 'phone', data: { number: c.substring(4) } };
  }
  if (c.startsWith('sms:')) {
    return { type: 'sms', data: parseSms(c) };
  }
  if (c.startsWith('https://wa.me/') || c.startsWith('https://api.whatsapp.com/')) {
    return { type: 'whatsapp', data: parseWhatsapp(c) };
  }
  if (c.startsWith('geo:') || c.startsWith('https://maps.google.com/')) {
    return { type: 'location', data: parseLocation(c) };
  }
  if (c.startsWith('bitcoin:') || c.startsWith('ethereum:') || c.startsWith('bnb:')) {
    return { type: 'crypto', data: parseCrypto(c) };
  }
  if (c.startsWith('000201') && c.includes('ID.CO.QRIS.WWW')) {
    return { type: 'qris', data: parseQris(c) };
  }
  
  const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
  if (urlRegex.test(c)) {
    // Check if it's a social profile
    const socialPlatforms = ['instagram', 'facebook', 'twitter', 'linkedin', 'github', 'youtube'];
    for (const p of socialPlatforms) {
      if (c.includes(`${p}.com`)) {
        return { type: 'social', data: { platform: p, url: c } };
      }
    }
    return { type: 'url', data: { url: c } };
  }

  return { type: 'text', data: { text: c } };
}

function parseWifi(content) {
  // WIFI:T:WPA;S:ssid;P:pass;H:false;
  const ssidMatch = content.match(/S:([^;]+)/);
  const passMatch = content.match(/P:([^;]+)/);
  const typeMatch = content.match(/T:([^;]+)/);
  const hidMatch = content.match(/H:([^;]+)/);

  const unescape = (str) => str ? str.replace(/\\(.)/g, '$1') : '';

  return {
    ssid: unescape(ssidMatch ? ssidMatch[1] : ''),
    password: unescape(passMatch ? passMatch[1] : ''),
    security: typeMatch ? typeMatch[1] : 'WPA',
    hidden: hidMatch ? hidMatch[1] === 'true' : false
  };
}

function parseVcard(content) {
  const getField = (field) => {
    const r = new RegExp(`${field}:([^\\r\\n]+)`, 'i');
    const m = content.match(r);
    return m ? m[1].replace(/\\(.)/g, '$1') : '';
  };

  const nameMatch = content.match(/N:([^;\r\n]+);([^;\r\n]*)/);
  const firstName = nameMatch ? (nameMatch[2] || '').trim() : '';
  const lastName = nameMatch ? (nameMatch[1] || '').trim() : '';

  return {
    first_name: firstName || getField('FN'),
    last_name: lastName,
    org: getField('ORG'),
    phone: getField('TEL'),
    email: getField('EMAIL'),
    website: getField('URL'),
    address: getField('ADR'),
    note: getField('NOTE')
  };
}

function parseEvent(content) {
  const getField = (field) => {
    const r = new RegExp(`${field}:([^\\r\\n]+)`, 'i');
    const m = content.match(r);
    return m ? m[1] : '';
  };

  const parseIcalDate = (dt) => {
    if (!dt) return '';
    // Format YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (m) {
      return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
    }
    return '';
  };

  return {
    title: getField('SUMMARY'),
    start: parseIcalDate(getField('DTSTART')),
    end: parseIcalDate(getField('DTEND')),
    location: getField('LOCATION'),
    description: getField('DESCRIPTION')
  };
}

function parseEmail(content) {
  // mailto:to?subject=sub&body=bod
  const clean = content.replace('mailto:', '');
  const parts = clean.split('?');
  const to = parts[0];
  const params = new URLSearchParams(parts[1] || '');
  return {
    to,
    subject: params.get('subject') || '',
    body: params.get('body') || ''
  };
}

function parseSms(content) {
  // sms:num?body=msg
  const clean = content.replace('sms:', '');
  const parts = clean.split('?');
  const number = parts[0];
  const params = new URLSearchParams(parts[1] || '');
  return {
    number,
    message: params.get('body') || ''
  };
}

function parseWhatsapp(content) {
  // https://wa.me/num?text=msg
  try {
    const urlObj = new URL(content);
    const number = urlObj.pathname.replace('/', '');
    const message = urlObj.searchParams.get('text') || '';
    return { number, message };
  } catch(e) {
    return { number: '', message: '' };
  }
}

function parseLocation(content) {
  if (content.startsWith('geo:')) {
    // geo:lat,lng?q=lat,lng
    const m = content.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/);
    return {
      lat: m ? m[1] : '',
      lng: m ? m[2] : '',
      label: ''
    };
  } else {
    // google map URL
    try {
      const urlObj = new URL(content);
      const q = urlObj.searchParams.get('q') || '';
      const label = urlObj.searchParams.get('label') || '';
      const m = q.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
      return {
        lat: m ? m[1] : '',
        lng: m ? m[2] : '',
        label
      };
    } catch(e) {
      return { lat: '', lng: '', label: '' };
    }
  }
}

function parseCrypto(content) {
  // bitcoin:address?amount=val
  const protocol = content.split(':')[0];
  const rest = content.replace(`${protocol}:`, '');
  const parts = rest.split('?');
  const address = parts[0];
  const params = new URLSearchParams(parts[1] || '');
  
  const mapSymbol = {
    bitcoin: 'BTC',
    ethereum: 'ETH',
    bnb: 'BNB'
  };

  return {
    currency: mapSymbol[protocol.toLowerCase()] || 'BTC',
    address,
    amount: params.get('amount') || ''
  };
}

function parseQris(content) {
  // Extract merchant ID tag 26 subtag 01
  const m = content.match(/26\d{2}.*?01(\d{15})/);
  const mName = content.match(/59(\d{2})([A-Z0-9\s#&*-]+)/);
  const mCity = content.match(/60(\d{2})([A-Z0-9\s#&*-]+)/);

  return {
    merchant_id: m ? m[1] : '',
    merchant_name: mName ? mName[2].substring(0, parseInt(mName[1])) : '',
    merchant_city: mCity ? mCity[2].substring(0, parseInt(mCity[1])) : ''
  };
}
