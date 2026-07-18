import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from '@/components/icons';

interface LoadingOverlayProps {
  show: boolean;
  label?: string;
}

/**
 * Full-bleed glass overlay for loads long enough to notice. The ring is a
 * conic-gradient arc masked into a circle (not a full spinner border) so it
 * reads as a slider orbiting the logo rather than a plain spinner.
 */
export function LoadingOverlay({ show, label }: LoadingOverlayProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/50 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-20 w-20 items-center justify-center"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0%, hsl(var(--primary) / 0.9) 18%, transparent 42%)',
                WebkitMask:
                  'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.55)]">
              <Sparkles className="h-6 w-6 text-black/80" />
            </div>
          </motion.div>
          {label && <p className="text-sm text-muted-foreground">{label}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
