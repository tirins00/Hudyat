import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AssistedCheckInPage } from './pages/AssistedCheckInPage';
import { CheckInScreen } from './pages/CheckInScreen';
import { ExpectedListPage } from './pages/ExpectedListPage';
import { HeadcountBoard } from './pages/HeadcountBoard';
import { SosPage } from './pages/SosPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeadcountBoard />} />
        <Route path="/headcount" element={<HeadcountBoard />} />
        <Route path="/expected-list" element={<ExpectedListPage />} />
        <Route path="/check-in" element={<CheckInScreen />} />
        <Route path="/assisted-check-in" element={<AssistedCheckInPage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="*" element={<Navigate to="/headcount" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
