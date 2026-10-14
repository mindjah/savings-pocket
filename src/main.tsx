import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-system/theme.css'
import App from './App.tsx'
import { handleDriveRedirect } from './lib/googleDrive'

// Before the first render, so screens mount already holding the token.
handleDriveRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
