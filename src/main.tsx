import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(<App />);

// AR.js has global side effects. Reset an active session on code edits during development.
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => {
  if (document.body.classList.contains('camera-open')) location.reload();
});
