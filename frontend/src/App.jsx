import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';

/**
 * Main application component with routing.
 * Routes are defined here and will grow as features are added.
 */
export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Future routes will be added here:
            /dashboard - Project dashboard
            /projects/:id - Project detail & breakdowns
            /upload - Script upload
            /login - Authentication
        */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}