import React, { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  public state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  public render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red'}}><h1>Something went wrong.</h1><pre>{this.state.error?.message}</pre><pre>{this.state.error?.stack}</pre></div>;
    }
    return this.props.children;
  }
}

console.log("main.tsx is executing!");

// Switch to a newly deployed version without needing a second app launch.
// Reload only right after opening or while the app is in the background, so a
// practice round in progress is never interrupted.
if ('serviceWorker' in navigator) {
  const openedAt = Date.now();
  const hadController = !!navigator.serviceWorker.controller;
  let pendingReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, page is already current
    if (document.hidden || Date.now() - openedAt < 15000) window.location.reload();
    else pendingReload = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (pendingReload) window.location.reload();
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {});
  });
}

const root = document.getElementById('root');
if (!root) {
  console.error("No root element found!");
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
