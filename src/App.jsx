// ═══════════════════════════════════════════════════════════════
// DARK HOLLOWS — APP ENTRY POINT
// ═══════════════════════════════════════════════════════════════

import Game from './components/Game.jsx';

function App() {
  return (
    <div style={styles.app}>
      <Game />
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0812 0%, #1a1028 50%, #0a0812 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
};

export default App;
