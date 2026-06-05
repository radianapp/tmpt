// Design Panel Setup (Templates, Color Pickers, and Options)

export const QR_TEMPLATES = [
  { id: 'classic', label: 'Klasik', dot_style: 'square', corner_style: 'square', foreground_color: '#000000', background_color: '#FFFFFF' },
  { id: 'rounded', label: 'Rounded', dot_style: 'rounded', corner_style: 'extra-rounded', foreground_color: '#000000', background_color: '#FFFFFF' },
  { id: 'restaurant', label: 'Restoran', dot_style: 'classy', corner_style: 'square', foreground_color: '#8B4513', background_color: '#FFF8DC' },
  { id: 'tech', label: 'Teknologi', dot_style: 'square', corner_style: 'extra-rounded', foreground_color: '#1a1a2e', background_color: '#E0F7FA' },
  { id: 'minimal', label: 'Minimal', dot_style: 'dots', corner_style: 'dot', foreground_color: '#2d3748', background_color: '#FFFFFF' },
  { id: 'elegant', label: 'Elegan', dot_style: 'classy', corner_style: 'extra-rounded', foreground_color: '#1a1a2e', background_color: '#F8F9FA' },
  { id: 'nature', label: 'Alam', dot_style: 'rounded', corner_style: 'dot', foreground_color: '#2d6a4f', background_color: '#D8F3DC' }
];

export function setupDesignListeners(onUpdate) {
  // Setup color picker sync
  setupColorPickerSync('fg-color', 'fg-color-hex', onUpdate);
  setupColorPickerSync('bg-color', 'bg-color-hex', onUpdate);
  setupColorPickerSync('grad-color1', 'grad-color1-hex', onUpdate);
  setupColorPickerSync('grad-color2', 'grad-color2-hex', onUpdate);
  setupColorPickerSync('frame-color', 'frame-color-hex', onUpdate);
  setupColorPickerSync('frame-text-color', 'frame-text-color-hex', onUpdate);

  // Gradient toggle listener
  const gradCheckbox = document.getElementById('enable-gradient');
  if (gradCheckbox) {
    gradCheckbox.addEventListener('change', (e) => {
      const pane = document.getElementById('gradient-options-pane');
      if (pane) {
        if (e.target.checked) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
      onUpdate();
    });
  }

  // Frame selection listener
  const frameStyleSelect = document.getElementById('frame-style');
  if (frameStyleSelect) {
    frameStyleSelect.addEventListener('change', (e) => {
      const pane = document.getElementById('frame-options-pane');
      if (pane) {
        if (e.target.value !== 'none') pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
      onUpdate();
    });
  }

  // Other input change listeners
  const inputs = [
    'dot-style', 'corner-style', 'grad-type', 'grad-angle',
    'logo-size', 'logo-padding', 'frame-text', 'qr-size', 'error-correction'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', onUpdate);
      el.addEventListener('change', onUpdate);
    }
  });

  // Logo upload listener
  const logoInput = document.getElementById('logo-file');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = document.getElementById('logo-preview');
          if (preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
          }
          onUpdate();
        };
        reader.readAsDataURL(file);
      }
    });

    const removeLogoBtn = document.getElementById('remove-logo-btn');
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', () => {
        logoInput.value = '';
        const preview = document.getElementById('logo-preview');
        if (preview) {
          preview.src = '';
          preview.classList.add('hidden');
        }
        onUpdate();
      });
    }
  }
}

function setupColorPickerSync(pickerId, hexId, onUpdate) {
  const picker = document.getElementById(pickerId);
  const hexInput = document.getElementById(hexId);

  if (!picker || !hexInput) return;

  picker.addEventListener('input', (e) => {
    hexInput.value = e.target.value.toUpperCase();
    onUpdate();
  });

  hexInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const isValidHex = /^#[0-9A-F]{6}$/i.test(val);
    if (isValidHex) {
      picker.value = val;
      onUpdate();
    }
  });
}

export function getDesignConfig() {
  const fg = document.getElementById('fg-color').value;
  const bg = document.getElementById('bg-color').value;

  const config = {
    size: parseInt(document.getElementById('qr-size').value) || 300,
    ecl: document.getElementById('error-correction').value || 'H',
    dot_style: document.getElementById('dot-style').value || 'square',
    corner_style: document.getElementById('corner-style').value || 'square',
    foreground_color: fg,
    background_color: bg
  };

  // Gradient
  const enableGradient = document.getElementById('enable-gradient').checked;
  if (enableGradient) {
    config.gradient = {
      type: document.getElementById('grad-type').value || 'linear',
      color1: document.getElementById('grad-color1').value,
      color2: document.getElementById('grad-color2').value,
      angle: parseInt(document.getElementById('grad-angle').value) || 0
    };
  }

  // Logo
  const logoPreview = document.getElementById('logo-preview');
  if (logoPreview && logoPreview.src && !logoPreview.classList.contains('hidden')) {
    config.logo = {
      data: logoPreview.src,
      size: parseInt(document.getElementById('logo-size').value) || 20,
      padding: parseInt(document.getElementById('logo-padding').value) || 5
    };
  }

  return config;
}

export function getFrameConfig() {
  const style = document.getElementById('frame-style').value || 'none';
  if (style === 'none') return null;

  return {
    style,
    color: document.getElementById('frame-color').value || '#000000',
    text: document.getElementById('frame-text').value || 'SCAN ME',
    text_color: document.getElementById('frame-text-color').value || '#FFFFFF'
  };
}

export function applyTemplate(template) {
  document.getElementById('dot-style').value = template.dot_style;
  document.getElementById('corner-style').value = template.corner_style;
  
  document.getElementById('fg-color').value = template.foreground_color;
  document.getElementById('fg-color-hex').value = template.foreground_color;

  document.getElementById('bg-color').value = template.background_color;
  document.getElementById('bg-color-hex').value = template.background_color;

  // Turn off gradient
  const grad = document.getElementById('enable-gradient');
  if (grad) {
    grad.checked = false;
    const pane = document.getElementById('gradient-options-pane');
    if (pane) pane.classList.add('hidden');
  }
}
