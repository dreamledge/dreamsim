const STORAGE_KEY = 'bg-music-time';

class AudioManager {
  constructor() {
    this.audio = new Audio('/miami.mp3');
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0.5;
    this.interval = null;
  }

  startInterval() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      if (this.audio && !this.audio.paused) {
        localStorage.setItem(STORAGE_KEY, this.audio.currentTime);
      } else {
        this.stopInterval();
      }
    }, 5000);
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  play() {
    if (this.audio.paused) {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
      if (saved && !isNaN(saved)) {
        this.audio.currentTime = saved;
      }
      this.audio.play().catch(() => {});
      this.startInterval();
    }
  }

  pause() {
    if (this.audio && !this.audio.paused) {
      localStorage.setItem(STORAGE_KEY, this.audio.currentTime);
      this.audio.pause();
      this.stopInterval();
    }
  }

  toggle() {
    if (!this.audio || this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  setVolume(value) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, value));
    }
  }
}

const audioManager = new AudioManager();
export default audioManager;
