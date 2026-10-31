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
import { ServiceMapPage } from '../features/service-map/ServiceMapPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { ServicesPage } from '../features/services/ServicesPage';
import { DependencyGraphConfigPage } from '../features/services/DependencyGraphConfigPage';

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
  // Step 3: Microservices
  {
    path: '/projects/:projectId/services',
    element: <ServicesPage />,
  },
  // Step 4: Dependency Graph Configuration
  {
    path: '/projects/:projectId/dependency-graph',
    element: <DependencyGraphConfigPage />,
  },
  // Step 5: Advanced AI Incident Triage, RCA & Telemetry Console
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
        path: 'service-map',
        element: <ServiceMapPage />,
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
