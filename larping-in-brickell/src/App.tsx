import { useUI } from './game/uiStore';
import { MainMenu } from './ui/screens/MainMenu';
import { GameView } from './ui/GameView';

export default function App() {
  const screen = useUI((s) => s.screen);
  return screen === 'menu' ? <MainMenu /> : <GameView />;
}
