import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CodeEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current JSON string — refreshed each time the modal opens */
  initialJson: string;
  /** Called when the user types valid JSON that also passes validation */
  onJsonChange: (json: string) => void;
  /** Validate the JSON string. Return null if valid, or an error message. */
  validate: (json: string) => string | null;
}

// Simple JSON syntax highlighter
function highlightJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex =
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])|(\s+)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(json.slice(lastIndex, match.index));
    }
    lastIndex = match.index + match[0].length;

    if (match[1]) {
      nodes.push(
        <span key={match.index} className="text-blue-600">
          {match[1]}
        </span>,
      );
      nodes.push(
        <span key={match.index + "_colon"} className="text-neutral-500">
          :
        </span>,
      );
    } else if (match[2]) {
      nodes.push(
        <span key={match.index} className="text-green-600">
          {match[2]}
        </span>,
      );
    } else if (match[3]) {
      nodes.push(
        <span key={match.index} className="text-purple-600">
          {match[3]}
        </span>,
      );
    } else if (match[4]) {
      nodes.push(
        <span key={match.index} className="text-orange-600">
          {match[4]}
        </span>,
      );
    } else if (match[5]) {
      nodes.push(
        <span key={match.index} className="text-neutral-500">
          {match[5]}
        </span>,
      );
    } else if (match[6]) {
      nodes.push(match[6]);
    }
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}

export function CodeEditorModal({
  open,
  onOpenChange,
  initialJson,
  onJsonChange,
  validate,
}: CodeEditorModalProps) {
  const [code, setCode] = useState(initialJson);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // When the sheet opens, reset to the current board state
  useEffect(() => {
    if (open) {
      setCode(initialJson);
      setError(null);
      setCopied(false);
    }
  }, [open, initialJson]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setCopied(false);

      try {
        JSON.parse(newCode);
      } catch {
        setError("Invalid JSON syntax");
        return;
      }

      const validationError = validate(newCode);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      onJsonChange(newCode);
    },
    [validate, onJsonChange],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newCode = code.substring(0, start) + "  " + code.substring(end);
        handleChange(newCode);
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
    },
    [code, handleChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-[28rem] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[28rem]"
        overlay={false}
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <div>
            <SheetTitle className="text-base">Code Editor</SheetTitle>
            <SheetDescription className="text-xs">
              Edit the puzzle JSON directly
            </SheetDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <ClipboardCopy className="size-4" />
              )}
            </Button>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="relative min-h-0 flex-1">
          {/* Highlighted code overlay */}
          <pre
            ref={highlightRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre p-4 font-mono text-sm leading-relaxed"
          >
            <code>{highlightJson(code)}</code>
          </pre>

          {/* Editable textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="absolute inset-0 size-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-neutral-800 outline-none"
          />
        </div>

        {/* Error bar */}
        {error && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
            {error}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
