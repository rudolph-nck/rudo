import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Splash, splashEnabled } from './components/Splash';
import { watchFavicon } from './components/logo';
import { launcherKey } from './store/storage';

launcherKey();
watchFavicon();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
    {splashEnabled() && <Splash />}
  </ErrorBoundary>,
);
