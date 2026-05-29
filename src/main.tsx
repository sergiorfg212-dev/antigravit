import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global patch to prevent html2canvas / canvas rendering crash when creating pattern with zero-size canvas/image
try {
  if (typeof window !== 'undefined') {
    const filterNoise = (args: any[]) => {
      const serialized = args.map(arg => {
        try {
          if (arg instanceof Error) {
            return (arg.stack || arg.message || String(arg));
          }
          if (typeof arg === 'object') {
            return JSON.stringify(arg);
          }
          return String(arg);
        } catch (e) {
          return String(arg);
        }
      }).join(' ').toLowerCase();

      return (
        serialized.includes('quota') ||
        serialized.includes('resource-exhausted') ||
        serialized.includes('exhausted') ||
        serialized.includes('firebase/firestore') ||
        serialized.includes('@firebase/firestore') ||
        serialized.includes('backoff delay') ||
        serialized.includes('quota_exceeded')
      );
    };

    const originalConsoleError = console.error;
    console.error = function(...args: any[]) {
      if (filterNoise(args)) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const originalConsoleWarn = console.warn;
    console.warn = function(...args: any[]) {
      if (filterNoise(args)) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };
  }
} catch (e) {}

try {
  if (typeof window !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined') {
    const originalCreatePattern = CanvasRenderingContext2D.prototype.createPattern;
    CanvasRenderingContext2D.prototype.createPattern = function(image: any, repetition: any) {
      let isZeroSize = false;
      if (image) {
        if (image instanceof HTMLCanvasElement || (image.tagName && image.tagName.toLowerCase() === 'canvas')) {
          if (image.width === 0 || image.height === 0) isZeroSize = true;
        } else if (image instanceof HTMLImageElement || (image.tagName && image.tagName.toLowerCase() === 'img')) {
          if (image.width === 0 || image.height === 0 || image.naturalWidth === 0 || image.naturalHeight === 0) isZeroSize = true;
        } else if (image instanceof HTMLVideoElement || (image.tagName && image.tagName.toLowerCase() === 'video')) {
          if (image.videoWidth === 0 || image.videoHeight === 0) isZeroSize = true;
        } else if (typeof image.width === 'number' && typeof image.height === 'number') {
          if (image.width === 0 || image.height === 0) isZeroSize = true;
        }
      }
      
      if (isZeroSize) {
        console.warn("Caught zero-size item in createPattern. Substituting with 1x1 dummy to prevent crash.");
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        return originalCreatePattern.call(this, dummyCanvas, repetition || 'repeat');
      }
      return originalCreatePattern.apply(this, arguments as any);
    };
  }
} catch (e) {
  console.error("Failed to patch CanvasRenderingContext2D.prototype.createPattern:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Progressive Web App Service Worker for Mobile Installation
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('NOM-030 PWA Service Worker registered successfully:', registration.scope);
      })
      .catch((err) => {
        console.error('NOM-030 PWA Service Worker registration failed:', err);
      });
  });
}


