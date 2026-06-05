// QR Scanner engine using jsQR library
// Assumes jsQR is imported via a global window.jsQR or ES module

let activeStream = null;

export function stopCameraScanner() {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

export function startCameraScanner(videoEl, canvasEl, onResult, onError) {
  const constraints = { 
    video: { facingMode: 'environment' } // prefer back camera
  };

  stopCameraScanner();

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      activeStream = stream;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', true); // required for iOS safari
      videoEl.play();

      const ctx = canvasEl.getContext('2d');

      const scan = () => {
        if (!activeStream) return; // stopped

        if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
          canvasEl.height = videoEl.videoHeight;
          canvasEl.width = videoEl.videoWidth;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

          const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code) {
            onResult(code.data);
            stopCameraScanner();
            return;
          }
        }
        requestAnimationFrame(scan);
      };
      
      requestAnimationFrame(scan);
    })
    .catch(err => {
      if (onError) onError('Kamera tidak dapat diakses: ' + err.message);
    });
}

export function scanFromImage(imageFile, onResult, onError) {
  const img = new Image();
  const reader = new FileReader();

  reader.onload = (e) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        onResult(code.data);
      } else {
        if (onError) onError('QR Code tidak terdeteksi dalam berkas gambar ini.');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(imageFile);
}
