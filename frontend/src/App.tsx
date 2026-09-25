import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { SourceDrive } from './pages/SourceDrive';
import { BackupAccounts } from './pages/BackupAccounts';
import { Transfer } from './pages/Transfer';
import { TransferHistory } from './pages/TransferHistory';
import { Settings } from './pages/Settings';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/source" element={<AppLayout><SourceDrive /></AppLayout>} />
        <Route path="/backups" element={<AppLayout><BackupAccounts /></AppLayout>} />
        <Route path="/transfer" element={<AppLayout><Transfer /></AppLayout>} />
        <Route path="/history" element={<AppLayout><TransferHistory /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
