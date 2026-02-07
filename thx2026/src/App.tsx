import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TopNav } from './components/TopNav';
import { AlertsPage } from './pages/Alerts';
import { AdmissionsPage } from './pages/Admissions';
import { AdminPage } from './pages/Admin';
import { LoginPage } from './pages/Login';
import { MessagesPage } from './pages/Messages';
import { NotFoundPage } from './pages/NotFound';
import { OverviewPage } from './pages/Overview';
import { PatientMonitorPage } from './pages/PatientMonitor';
import { PatientDetailPage } from './pages/PatientDetail';
import { PatientPortalPage } from './pages/PatientPortal';
import { RoomsIndexPage } from './pages/RoomsIndex';
import { RoomDetailPage } from './pages/RoomDetail';
import { TasksPage } from './pages/Tasks';
import { PatientsIndexPage } from './pages/patients/PatientsIndex';
import { startCvSimulator } from './services/cvSimulator';
import { useEffect } from 'react';
import { sensors, rooms } from './data/mock';
import { MonitorStoreProvider } from './store/monitorStore';
import './App.css';

function App() {
  useEffect(() => {
    const stop = startCvSimulator(
      rooms.map((room) => room.id),
      sensors.map((sensor) => sensor.id)
    );
    return () => stop();
  }, []);

  return (
    <MonitorStoreProvider>
      <div className="app-shell">
        <TopNav />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Layout>
                <OverviewPage />
              </Layout>
            }
          />
          <Route path="/monitor" element={<PatientMonitorPage />} />
          <Route
            path="/rooms"
            element={
              <Layout>
                <RoomsIndexPage />
              </Layout>
            }
          />
          <Route
            path="/rooms/:roomId"
            element={
              <Layout>
                <RoomDetailPage />
              </Layout>
            }
          />
          <Route
            path="/patients"
            element={
              <Layout>
                <PatientsIndexPage />
              </Layout>
            }
          />
          <Route
            path="/patients/:patientId"
            element={
              <Layout>
                <PatientDetailPage />
              </Layout>
            }
          />
          <Route
            path="/admissions"
            element={
              <Layout>
                <AdmissionsPage />
              </Layout>
            }
          />
          <Route
            path="/tasks"
            element={
              <Layout>
                <TasksPage />
              </Layout>
            }
          />
          <Route
            path="/messages"
            element={
              <Layout>
                <MessagesPage />
              </Layout>
            }
          />
          <Route
            path="/alerts"
            element={
              <Layout>
                <AlertsPage />
              </Layout>
            }
          />
          <Route path="/patient-portal" element={<PatientPortalPage />} />
          <Route
            path="/admin"
            element={
              <Layout>
                <AdminPage />
              </Layout>
            }
          />
          <Route
            path="*"
            element={
              <Layout>
                <NotFoundPage />
              </Layout>
            }
          />
        </Routes>
      </div>
    </MonitorStoreProvider>
  );
}

export default App;
