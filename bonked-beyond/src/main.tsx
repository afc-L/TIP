import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/900.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/menu.css';
import './styles/hud.css';
import './styles/overlays.css';

createRoot(document.getElementById('root')!).render(<App />);
