// API configuration
// In production (Vercel), use the full Railway URL
// In development, use the local proxy
export const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? "https://fortune-pipeline.up.railway.app"
    : "";

// Helper function to build API URLs
export const getApiUrl = (path: string) => {
  // For development, we use the Vite proxy, so just use /api
  // For production, we use the full URL
  if (import.meta.env.MODE === "production") {
    return `${API_BASE_URL}${path}`;
  }
  return `/api${path}`;
};
