import { useNavigate } from 'react-router-dom';
import { MessageSquare } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAskAiStore } from '@/stores/askAiStore';
import { AskAiChat } from './AskAiChat';

export function AskAiModal(): React.JSX.Element {
  const navigate = useNavigate();
  const isModalOpen = useAskAiStore((s) => s.isModalOpen);
  const closeModal = useAskAiStore((s) => s.closeModal);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex max-w-2xl flex-col gap-4 sm:rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle>Ask AI</DialogTitle>
              <DialogDescription>Quick chat with your configured provider.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <AskAiChat
          variant="modal"
          onRequestViewHistory={() => {
            closeModal();
            navigate('/ask-ai');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
