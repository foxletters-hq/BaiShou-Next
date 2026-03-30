import './assets/main.css'

window.onerror = (message, _s, _l, _c, error) => {
  document.body.innerHTML = `<div style="background:#222;color:red;padding:20px;font-size:16px;white-space:pre-wrap;height:100vh;">
    <h1>FATAL ERROR</h1>
    <b>Message:</b> ${message}<br/>
    <b>Stack:</b> ${error?.stack || 'No stack'}
  </div>`;
};

window.addEventListener("unhandledrejection", (event) => {
  document.body.innerHTML = `<div style="background:#222;color:orange;padding:20px;font-size:16px;white-space:pre-wrap;height:100vh;">
    <h1>UNHANDLED PROMISE REJECTION</h1>
    <b>Reason:</b> ${event.reason?.stack || event.reason}
  </div>`;
});
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
