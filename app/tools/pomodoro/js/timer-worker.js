// app/tools/pomodoro/js/timer-worker.js

let intervalId = null;
let remaining = 0; // remaining seconds
let totalSeconds = 0;

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'START':
      remaining = data.seconds;
      totalSeconds = data.seconds;
      clearInterval(intervalId);
      intervalId = setInterval(() => {
        remaining--;
        self.postMessage({ type: 'TICK', remaining, total: totalSeconds });
        if (remaining <= 0) {
          clearInterval(intervalId);
          self.postMessage({ type: 'COMPLETE' });
        }
      }, 1000);
      break;

    case 'PAUSE':
      clearInterval(intervalId);
      self.postMessage({ type: 'PAUSED', remaining });
      break;

    case 'RESUME':
      clearInterval(intervalId);
      intervalId = setInterval(() => {
        remaining--;
        self.postMessage({ type: 'TICK', remaining, total: totalSeconds });
        if (remaining <= 0) {
          clearInterval(intervalId);
          self.postMessage({ type: 'COMPLETE' });
        }
      }, 1000);
      break;

    case 'RESET':
      clearInterval(intervalId);
      remaining = data.seconds;
      self.postMessage({ type: 'RESET', remaining });
      break;
  }
};
