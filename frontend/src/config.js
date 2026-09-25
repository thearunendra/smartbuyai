// Set VITE_API_URL to the backend's address when building for production
// (on Render it comes from render.yaml / the service's environment).
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";
