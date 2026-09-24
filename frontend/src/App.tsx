import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { SourceDrive } from './pages/SourceDrive';
import { BackupAccounts } from './pages/BackupAccounts';
import { Transfer } from './pages/Transfer';
import { TransferHistory } from './pages/TransferHistory';
import { Settings } from './pages/Settings';

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/source" element={<SourceDrive />} />
          <Route path="/backups" element={<BackupAccounts />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/history" element={<TransferHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
