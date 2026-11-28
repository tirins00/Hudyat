import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './routes/AuthProvider.jsx';
import RoleRouter from './routes/RoleRouter.jsx';
import { unlockAudio } from './services/SoundService.js';

function App() {
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudio();
    };

    const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleFirstInteraction, {
        passive: true,
        capture: true,
      });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleFirstInteraction, {
          capture: true,
        });
      });
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
