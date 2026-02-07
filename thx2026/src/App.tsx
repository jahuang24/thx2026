import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { sensors, rooms } from './data/mock';
import { AdminPage } from './pages/Admin';
import { AdmissionsPage } from './pages/Admissions';
import { AlertsPage } from './pages/Alerts';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { DoctorLogin } from './pages/DoctorLogin';
import { Login } from './pages/Login';
import { MessagesPage } from './pages/Messages';
import { NotFoundPage } from './pages/NotFound';
import { PatientLogin } from './pages/PatientLogin';
import { PatientDetailPage } from './pages/PatientDetail';
import { PatientMonitorPage } from './pages/PatientMonitor';
import PatientMonitorSearch from './pages/PatientMonitorSearch';
import { PatientPortalPage } from './pages/PatientPortal';
import { RoomDetailPage } from './pages/RoomDetail';
import { RoomsIndexPage } from './pages/RoomsIndex';
import { TasksPage } from './pages/Tasks';
import { PatientsIndexPage } from './pages/patients/PatientsIndex';
import { startCvSimulator } from './services/cvSimulator';
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
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/doctor-login" element={<DoctorLogin />} />
      <Route path="/patient-login" element={<PatientLogin />} />
      <Route
        path="/doctor-dashboard"
        element={
          <Layout pageTitle="Unit Overview">
            <DoctorDashboard />
          </Layout>
        }
      />
      <Route
        path="/monitor"
        element={
          <Layout pageTitle="Patient Monitor">
            <PatientMonitorSearch />
          </Layout>
        }
      />
      <Route
        path="/monitor/:patientId"
        element={
          <Layout pageTitle="Patient Monitor">
            <MonitorStoreProvider>
              <PatientMonitorPage />
            </MonitorStoreProvider>
          </Layout>
        }
      />
      <Route
        path="/rooms"
        element={
          <Layout pageTitle="Rooms">
            <RoomsIndexPage />
          </Layout>
        }
      />
      <Route
        path="/rooms/:roomId"
        element={
          <Layout pageTitle="Room Detail">
            <RoomDetailPage />
          </Layout>
        }
      />
      <Route
        path="/patients"
        element={
          <Layout pageTitle="Patients">
            <PatientsIndexPage />
          </Layout>
        }
      />
      <Route
        path="/patients/:patientId"
        element={
          <Layout pageTitle="Patient Detail">
            <PatientDetailPage />
          </Layout>
        }
      />
      <Route
        path="/admissions"
        element={
          <Layout pageTitle="Admissions & Placement">
            <AdmissionsPage />
          </Layout>
        }
      />
      <Route
        path="/tasks"
        element={
          <Layout pageTitle="Tasks">
            <TasksPage />
          </Layout>
        }
      />
      <Route
        path="/messages"
        element={
          <Layout pageTitle="Patient Messages">
            <MessagesPage />
          </Layout>
        }
      />
      <Route
        path="/alerts"
        element={
          <Layout pageTitle="Alerts">
            <AlertsPage />
          </Layout>
        }
      />
      <Route
        path="/admin"
        element={
          <Layout pageTitle="Admin">
            <AdminPage />
          </Layout>
        }
      />
      <Route path="/patient-portal" element={<PatientPortalPage />} />
      <Route
        path="*"
        element={
          <Layout pageTitle="Not Found">
            <NotFoundPage />
          </Layout>
        }
      />
    </Routes>
  );
}

export default App;
