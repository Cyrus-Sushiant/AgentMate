import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Imported as JS modules, not CSS @import in index.css — Vite/Tailwind v4's
// CSS-import asset resolution doesn't rebase these packages' internal woff2
// url()s, so the font files silently fail to end up in the build output.
import '@fontsource-variable/inter';
import '@fontsource-variable/vazirmatn';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
