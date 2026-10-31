import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from '../pages/landing/LandingPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { OverviewPage } from '../features/overview/OverviewPage';
import { LogExplorerPage } from '../features/log-explorer/LogExplorerPage';
import { LogClustersPage } from '../features/log-clusters/LogClustersPage';
import { AnomaliesPage } from '../features/anomalies/AnomaliesPage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
import { IncidentDetailPage } from '../features/incidents/IncidentDetailPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  // Step 1: Organizations
  {
    path: '/organizations',
    element: <OrganizationsPage />,
  },
  // Step 2: Projects
  {
    path: '/organizations/:orgId/projects',
    element: <ProjectsPage />,
  },
  // Main Dashboard: Statistical Anomaly Detection & Point-Based RCA
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: 'logs',
        element: <LogExplorerPage />,
      },
      {
        path: 'clusters',
        element: <LogClustersPage />,
      },
      {
        path: 'anomalies',
        element: <AnomaliesPage />,
      },
      {
        path: 'incidents',
        element: <IncidentsPage />,
      },
      {
        path: 'incidents/:id',
        element: <IncidentDetailPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
