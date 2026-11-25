import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ExpectedListPage } from './pages/ExpectedListPage';
import { HeadcountBoard } from './pages/HeadcountBoard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeadcountBoard />} />
        <Route path="/headcount" element={<HeadcountBoard />} />
        <Route path="/expected-list" element={<ExpectedListPage />} />
        <Route path="*" element={<Navigate to="/headcount" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
