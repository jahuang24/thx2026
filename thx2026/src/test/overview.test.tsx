import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { DoctorDashboard } from '../pages/DoctorDashboard';

const Wrapper = ({ children }: { children: React.ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;

describe('DoctorDashboard', () => {
  it('renders key dashboard sections', () => {
    render(<DoctorDashboard />, { wrapper: Wrapper });
    expect(screen.getByText(/Unit Rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Alerts/i)).toBeInTheDocument();
  });
});
