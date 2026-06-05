// Content Builders for 13 QR Code Types

export const CONTENT_BUILDERS = {
  url: (data) => {
    let url = (data.url || '').trim();
    if (url && !url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    return url;
  },

  text: (data) => data.text || '',

  email: (data) => {
    const to = (data.to || '').trim();
    const subject = (data.subject || '').trim();
    const body = (data.body || '').trim();
    let mailto = `mailto:${to}`;
    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    if (params.length > 0) {
      mailto += `?${params.join('&')}`;
    }
    return mailto;
  },

  phone: (data) => {
    const num = (data.number || '').replace(/[^0-9+]/g, '');
    return `tel:${num}`;
  },

  sms: (data) => {
    const num = (data.number || '').replace(/[^0-9+]/g, '');
    const msg = (data.message || '').trim();
    return `sms:${num}${msg ? `?body=${encodeURIComponent(msg)}` : ''}`;
  },

  whatsapp: (data) => {
    const num = (data.number || '').replace(/[^0-9+]/g, '').replace(/^0/, '62');
    const msg = (data.message || '').trim();
    const base = `https://wa.me/${num}`;
    return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
  },

  location: (data) => {
    const lat = parseFloat(data.lat) || 0;
    const lng = parseFloat(data.lng) || 0;
    const label = (data.label || '').trim();
    if (label) {
      return `https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(label)}`;
    }
    return `geo:${lat},${lng}?q=${lat},${lng}`;
  },

  wifi: (data) => {
    const ssid = (data.ssid || '');
    const password = (data.password || '');
    const security = data.security || 'WPA';
    const hidden = data.hidden ? 'true' : 'false';

    const escapeWifi = (str) => str.replace(/[\\;,"]/g, c => '\\' + c);

    if (security === 'nopass') {
      return `WIFI:T:nopass;S:${escapeWifi(ssid)};;H:${hidden};`;
    }
    return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${hidden};`;
  },

  vcard: (data) => {
    const escapeVcard = (str) => (str || '').replace(/([\\,;])/g, '\\$1');
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${escapeVcard(data.last_name)};${escapeVcard(data.first_name)};;;`,
      `FN:${escapeVcard(data.first_name)} ${escapeVcard(data.last_name)}`,
      data.org && `ORG:${escapeVcard(data.org)}`,
      data.phone && `TEL;TYPE=CELL:${data.phone}`,
      data.email && `EMAIL:${data.email}`,
      data.website && `URL:${data.website}`,
      data.address && `ADR;TYPE=WORK:;;${escapeVcard(data.address)};;;;`,
      data.note && `NOTE:${escapeVcard(data.note)}`,
      'END:VCARD'
    ].filter(Boolean);
    return lines.join('\r\n');
  },

  event: (data) => {
    const escapeIcal = (str) => (str || '').replace(/([\\,;])/g, '\\$1');
    const toIcalDate = (dtStr) => {
      if (!dtStr) return '';
      const d = new Date(dtStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const lines = [
      'BEGIN:VEVENT',
      `SUMMARY:${escapeIcal(data.title)}`,
      `DTSTART:${toIcalDate(data.start)}`,
      `DTEND:${toIcalDate(data.end)}`,
      data.location && `LOCATION:${escapeIcal(data.location)}`,
      data.description && `DESCRIPTION:${escapeIcal(data.description)}`,
      'END:VEVENT'
    ].filter(Boolean);
    return lines.join('\r\n');
  },

  crypto: (data) => {
    const currency = data.currency || 'BTC';
    const address = (data.address || '').trim();
    const amount = parseFloat(data.amount) || 0;

    const protocols = {
      BTC: `bitcoin:${address}`,
      ETH: `ethereum:${address}`,
      BNB: `bnb:${address}`,
      USDT: `ethereum:${address}`
    };

    let url = protocols[currency] || address;
    if (amount) {
      url += `?amount=${amount}`;
    }
    return url;
  },

  social: (data) => {
    const url = (data.url || '').trim();
    const platform = data.platform || 'instagram';
    const username = (data.username || '').trim();
    return url || `https://${platform}.com/${username}`;
  },

  qris: (data) => {
    const merchantId = (data.merchant_id || '').trim();
    
    // Static QRIS EMV Code implementation
    // Format: 000201 (Payload Format Indicator)
    // 010211 (Point of Initiation Method: 11 for static)
    // 26 (Merchant Account Information - QRIS)
    //   0015ID.CO.QRIS.WWW (Reverse Domain/Globally Unique ID)
    //   0115 + Merchant ID
    //   0203000 (Merchant Criteria)
    // 51 (National Merchant ID - alternative mapping if needed)
    // 52045812 (Merchant Category Code)
    // 5303360 (Transaction Currency: 360 for IDR)
    // 5802ID (Country Code)
    // 59 + length + name (Merchant Name)
    // 60 + length + city (Merchant City)
    // 6304 + CRC16

    const merchantName = (data.merchant_name || 'MERCHANT TMPT').toUpperCase();
    const merchantCity = (data.merchant_city || 'JAKARTA').toUpperCase();

    const buildEMVTag = (tag, value) => {
      const len = String(value.length).padStart(2, '0');
      return tag + len + value;
    };

    // Calculate CRC16 CCITT
    const calcCRC16 = (str) => {
      let crc = 0xFFFF;
      for (let c = 0; c < str.length; c++) {
        let code = str.charCodeAt(c);
        crc ^= (code << 8);
        for (let i = 0; i < 8; i++) {
          if (crc & 0x8000) {
            crc = (crc << 1) ^ 0x1021;
          } else {
            crc = (crc << 1);
          }
        }
      }
      crc &= 0xFFFF;
      return crc.toString(16).toUpperCase().padStart(4, '0');
    };

    // Merchant Account Info
    const subTags = 
      buildEMVTag('00', 'ID.CO.QRIS.WWW') +
      buildEMVTag('01', merchantId) +
      buildEMVTag('02', '03') + // criteria default
      buildEMVTag('03', '00');

    let qrisData = 
      buildEMVTag('00', '01') +
      buildEMVTag('01', '11') + // Point of initiation method: static
      buildEMVTag('26', subTags) +
      buildEMVTag('52', '0000') + // Merchant Category Code
      buildEMVTag('53', '360') + // Currency: IDR
      buildEMVTag('58', 'ID') + // Country Code
      buildEMVTag('59', merchantName) +
      buildEMVTag('60', merchantCity) +
      '6304'; // Tag CRC16 indicator

    const crc = calcCRC16(qrisData);
    return qrisData + crc;
  },

  custom: (data) => data.raw || ''
};
