import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './routes/AuthProvider.jsx';
import RoleRouter from './routes/RoleRouter.jsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
