import { useNavigate } from 'react-router-dom';
import { MessageSquare } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAskAiStore } from '@/stores/askAiStore';
import { AskAiChat } from './AskAiChat';

export function AskAiModal(): React.JSX.Element {
  const navigate = useNavigate();
  const isModalOpen = useAskAiStore((s) => s.isModalOpen);
  const closeModal = useAskAiStore((s) => s.closeModal);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex max-w-xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Ask AI
          </DialogTitle>
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
