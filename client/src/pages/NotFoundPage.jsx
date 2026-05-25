import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold text-gray-200 mb-3">404</h1>
      <p className="text-gray-400 mb-6">That route doesn't exist.</p>
      <Link to="/" className="btn-primary text-sm">Go home</Link>
    </motion.div>
  );
}
