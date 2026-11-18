"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

interface EndEventControlProps {
  isEnding: boolean;
  onEnd: () => void;
}

/** Two-step button: ending an event deletes every remaining photo, message, Instagram handle and LINE ID (PDPA); shown ones are already gone. */
export function EndEventControl({ isEnding, onEnd }: EndEventControlProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        End event
      </Button>
    );
  }

  return (
    <div role="alertdialog" aria-label="Confirm end event" className="flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 p-2">
      <p className="text-sm text-danger">
        Close the screen and permanently delete all photos, messages, Instagram handles and LINE IDs?
      </p>
      <Button variant="danger" isLoading={isEnding} onClick={onEnd}>
        Yes, end and delete
      </Button>
      <Button variant="ghost" onClick={() => setIsConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
