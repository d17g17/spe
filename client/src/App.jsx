import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toaster from './components/Toaster.jsx';
import ProfilesPage from './features/profiles/ProfilesPage.jsx';
import ProfilePage from './features/profile/ProfilePage.jsx';
import CrawlPage from './features/crawl/CrawlPage.jsx';
import StarredPage from './features/profiles/StarredPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Layout>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<ProfilesPage />} />
              <Route path="/profile/:steamId" element={<ProfilePage />} />
              <Route path="/crawl" element={<CrawlPage />} />
              <Route path="/starred" element={<StarredPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AnimatePresence>
        </Layout>
      </main>
      <Toaster />
    </div>
  );
}
