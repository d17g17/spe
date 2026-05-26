import { motion } from 'framer-motion';

export default function ConfirmationDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  secondaryLabel,
  onConfirm,
  onCancel,
  onSecondary,
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-300 mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost text-sm">{cancelLabel}</button>
          {onSecondary && secondaryLabel && (
            <button onClick={onSecondary} className="btn-secondary text-sm">{secondaryLabel}</button>
          )}
          <button onClick={onConfirm} className="btn-danger text-sm">{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}
