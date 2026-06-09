import { motion } from 'framer-motion';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
            <span className="text-white text-lg font-bold">A</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">Acadex</span>
        </div>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-primary-500"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
