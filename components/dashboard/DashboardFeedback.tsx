"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Request = {
  message: string;
  confirmation: boolean;
  initialValue?: string;
  resolve?: (accepted: boolean, value?: string) => void;
};
type Feedback = {
  confirm: (message: string) => Promise<boolean>;
  notify: (message: string) => void;
  prompt: (message: string, initialValue?: string) => Promise<string | null>;
};
const FeedbackContext = createContext<Feedback | null>(null);

/** Keep confirmations keyboard accessible and themed, including portaled content. */
export function DashboardFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const pending = useRef(
    new Set<(accepted: boolean, value?: string) => void>(),
  );
  const [inputValue, setInputValue] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        pending.current.add(resolve);
        setRequests((queue) => [
          ...queue,
          { message, confirmation: true, resolve },
        ]);
      }),
    [],
  );
  const prompt = useCallback(
    (message: string, initialValue = "") =>
      new Promise<string | null>((resolve) => {
        const finish = (accepted: boolean, value = "") =>
          resolve(accepted ? value || initialValue : null);
        pending.current.add(finish);
        setRequests((queue) => [
          ...queue,
          { message, confirmation: true, initialValue, resolve: finish },
        ]);
      }),
    [],
  );
  const notify = useCallback((message: string) => {
    setRequests((queue) => [...queue, { message, confirmation: false }]);
  }, []);
  useEffect(() => {
    const resolvers = pending.current;
    return () => {
      for (const resolve of resolvers) resolve(false);
      resolvers.clear();
    };
  }, []);
  const current = requests[0];
  useEffect(() => {
    setInputValue(current?.initialValue ?? "");
  }, [current]);
  function close(accepted: boolean) {
    if (current?.resolve) {
      pending.current.delete(current.resolve);
      current.resolve(accepted, inputValue.trim());
    }
    setRequests((queue) => queue.slice(1));
  }
  return (
    <FeedbackContext.Provider value={{ confirm, notify, prompt }}>
      {children}
      <Dialog
        open={Boolean(current)}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onOpenAutoFocus={(event) => {
            // Destructive operations require a deliberate choice; start on Cancel.
            if (current?.confirmation && current.initialValue === undefined) {
              event.preventDefault();
              cancelButton.current?.focus();
            }
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              close(true);
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {current?.confirmation ? "Confirm action" : "Notification"}
              </DialogTitle>
              <DialogDescription className="whitespace-pre-wrap break-words">
                {current?.message}
              </DialogDescription>
            </DialogHeader>
            {current?.initialValue !== undefined && (
              <label className="mt-4 grid gap-2 text-sm font-medium">
                Reason
                <Input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                />
              </label>
            )}
            <DialogFooter className="mt-6">
              {current?.confirmation && (
                <Button
                  ref={cancelButton}
                  type="button"
                  variant="outline"
                  onClick={() => close(false)}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant={current?.confirmation ? "destructive" : "default"}
              >
                {current?.confirmation ? "Confirm" : "Close"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useDashboardFeedback() {
  const feedback = useContext(FeedbackContext);
  if (!feedback)
    throw new Error("Dashboard feedback requires DashboardFeedbackProvider");
  return feedback;
}
