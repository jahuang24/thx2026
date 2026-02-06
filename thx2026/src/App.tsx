import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AlertsPage } from './pages/Alerts';
import { AdmissionsPage } from './pages/Admissions';
import { AdminPage } from './pages/Admin';
import { Login } from './pages/Login';
import { DoctorLogin } from './pages/DoctorLogin';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { MessagesPage } from './pages/Messages';

import { PatientDetailPage } from './pages/PatientDetail';
import { PatientPortalPage } from './pages/PatientPortal';
import { RoomsIndexPage } from './pages/RoomsIndex';
import { RoomDetailPage } from './pages/RoomDetail';
import { TasksPage } from './pages/Tasks';
import { NotFoundPage } from './pages/NotFound';

import { PatientsIndexPage } from './pages/patients/PatientsIndex';
import { startCvSimulator } from './services/cvSimulator';
import { useEffect } from 'react';
import { sensors, rooms } from './data/mock';

function App() {
  useEffect(() => {
    const stop = startCvSimulator(
      rooms.map((room) => room.id),
      sensors.map((sensor) => sensor.id)
    );
    return () => stop();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/doctor-login" element={<DoctorLogin />} />
        <Route
          path="/"
          element={<Login />}
        />
        <Route
          path="/doctor-dashboard"
          element={
            <Layout>
              <DoctorDashboard />
            </Layout>
          }
        />
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
    </BrowserRouter>
  );
}

export default App;
