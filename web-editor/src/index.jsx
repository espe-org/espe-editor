import React from 'react';
import { createRoot } from 'react-dom/client';
import Editor from './Editor';

// Mirrors @10play/tentap-editor's own bootstrap:
// react-native-webview sometimes injects content (window.* globals) AFTER the
// page loads, so we wait until RN signals window.contentInjected before mounting.
const contentInjected = () => window.contentInjected;

const interval = setInterval(() => {
  if (!contentInjected()) return;
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(<Editor />);
  clearInterval(interval);
}, 1);
