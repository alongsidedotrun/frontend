import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileExtensionBadge, extensionOf, stripExtension } from "@/components/file-extension-badge";
import { DeleteIcon, EditIcon } from "@/components/icons/untitled-ui";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownTrigger as BaseDropdownTrigger,
  DropdownContent as BaseDropdownContent,
  DropdownLabel as BaseDropdownLabel,
} from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { MoreTrigger } from "@/components/ui/more-trigger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Real bug, confirmed directly ("The right sidebar at the chat is missing
// ... the three dots to rename or delete the file is missing too"):
// LibraryFileMoreMenu/LibraryFileNameCell used to live only in
// LibraryPage.tsx, so right-panel.tsx's own ChatFileListPanel (a second,
// real consumer that needs the exact same rename/delete "..." menu) had no
// way to reuse them and just never got one at all. Extracted verbatim, not
// reimplemented -- same real Base UI dropdown, same focus-stealing
// workaround, same confirm-swaps-the-dropdown-content-in-place delete
// pattern every other "..." menu in this app already uses.

// Shared "..." > Rename file / Delete file menu for a file row -- per
// explicit request ("we should have a three dots for a more dropdown like
// we do in most other three dots... Delete file"), and a follow-up
// ("rename is missing... on top of delete file"). Same confirm-swaps-the-
// dropdown-content-in-place pattern as sidebar-nav.tsx's own ChatRow/
// ProjectRow for Delete; Rename instead just closes the menu and hands
// off to the row's own inline rename input (LibraryFileNameCell, below),
// matching ProjectRow's own "swap the label for an input" rename UI
// rather than a rename dialog.
export function LibraryFileMoreMenu({
  fileName,
  onRenameRequest,
  onDelete,
}: {
  fileName: string;
  onRenameRequest: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  // Same reblur fix sidebar-nav.tsx's own ChatRow/ProjectRow triggers use
  // -- real bug, confirmed directly ("the rename file is not working...
  // I press enter to save and never saves"): Base UI returns real DOM
  // focus to this trigger a beat after the menu closes, which stole focus
  // straight back off Rename's own inline input (autoFocus only fires
  // once, on mount, so it never gets a second chance to reclaim focus
  // once Base UI's delayed refocus wins) -- keystrokes, Enter included,
  // were landing on this button instead of the input the whole time.
  function handleMenuOpenChange(open: boolean) {
    setMenuOpen(open);
    // Reset to the plain menu, not the confirm prompt, same as
    // ChatRow/ProjectRow's own identical reset.
    if (!open) setConfirmingDelete(false);
    if (open) return;
    const button = menuTriggerRef.current;
    if (!button) return;
    const reblur = () => button.blur();
    button.addEventListener("focus", reblur, { once: true });
    setTimeout(() => button.removeEventListener("focus", reblur), 1000);
  }

  return (
    <BaseDropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <BaseDropdownTrigger
        render={
          <MoreTrigger
            ref={menuTriggerRef}
            aria-label={`More options for ${fileName}`}
            onClick={(event) => event.stopPropagation()}
            active={menuOpen}
          />
        }
      />
      <BaseDropdownContent align="start" side="right" className="w-40 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {confirmingDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <BaseDropdownLabel>Delete</BaseDropdownLabel>
              <div className="px-2 pb-2 text-[11px] font-normal text-foreground">Would you like to delete this file?</div>
              <div className="flex gap-1.5 px-2 pb-1.5">
                <Button
                  variant="outline"
                  className="h-7 flex-1 text-[11px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingDelete(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="h-7 flex-1 bg-red-600 text-[11px] text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <BaseDropdownLabel>More</BaseDropdownLabel>
              <BaseMenuItem
                index={0}
                icon={EditIcon}
                label="Rename file"
                className="gap-[7px]"
                onSelect={onRenameRequest}
              />
              <BaseMenuItem
                index={1}
                icon={DeleteIcon}
                label="Delete file"
                destructive
                closeOnClick={false}
                className="gap-[7px]"
                onSelect={() => setConfirmingDelete(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </BaseDropdownContent>
    </BaseDropdownMenu>
  );
}

export function LibraryFileNameCell({
  leaf,
  onRename,
  onDelete,
}: {
  leaf: string;
  onRename: (newLeaf: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(() => stripExtension(leaf));
  const ext = extensionOf(leaf);
  const inputRef = useRef<HTMLInputElement>(null);
  // autoFocus alone lost every time to the "..." dropdown's own closing
  // popup: Base UI keeps focus trapped inside a Menu.Popup until it's
  // actually done closing (its exit animation, not just visually faded),
  // so autoFocus's one and only attempt -- firing the instant this input
  // mounts, well before that trap releases -- was simply overridden. Real
  // bug, confirmed directly ("I press enter to save and never saves"),
  // still not resolved by a single delayed re-focus attempt (Base UI's
  // own exact release timing isn't a fixed, reliably-outrunnable number).
  // Polls every animation frame instead, for up to 1s, re-asserting focus
  // on every frame it isn't already there -- outlasts the trap regardless
  // of its actual duration, and stops the moment focus genuinely sticks
  // (checked via document.activeElement, not just "did .focus() throw").
  useEffect(() => {
    if (!renaming) return;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const input = inputRef.current;
      if (!input) return;
      if (document.activeElement !== input) {
        input.focus();
        input.select();
      } else {
        return;
      }
      if (performance.now() - start < 1000) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [renaming]);

  function commitRename() {
    const trimmed = draft.trim();
    const base = stripExtension(leaf);
    if (trimmed && trimmed !== base) onRename(ext ? `${trimmed}.${ext}` : trimmed);
    setRenaming(false);
  }

  return (
    <>
      <FileExtensionBadge name={leaf} />
      {renaming ? (
        <Input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commitRename}
          onKeyDown={(event) => {
            // stopPropagation -- a row that also listens for Enter/Space
            // at the row level to open the file (role="button" there, not
            // a real <button>) would otherwise also bubble a rename-commit
            // Enter up and open the file right after.
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(stripExtension(leaf));
              setRenaming(false);
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-5 min-w-0 flex-1 border-none bg-transparent px-1 text-xs focus-visible:ring-0"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{stripExtension(leaf)}</span>
      )}
      <LibraryFileMoreMenu
        fileName={leaf}
        onRenameRequest={() => {
          setDraft(stripExtension(leaf));
          setRenaming(true);
        }}
        onDelete={onDelete}
      />
    </>
  );
}
