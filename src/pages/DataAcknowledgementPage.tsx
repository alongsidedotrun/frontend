import { useEffect, useRef, useState } from "react";
import { Copy, KeyRound, Trash2, X } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlongsideLogo } from "@/components/icons/alongside-logo";
import { GettingStartedRows } from "@/components/getting-started-rows";
import { SetupDialog } from "@/components/ui/setup-dialog";
import { ONBOARDING_COMPLETE_KEY } from "@/lib/onboarding";
import { clearDataAcknowledgement, loadDataAcknowledgement, saveDataAcknowledgement } from "@/lib/data-acknowledgement";

export function DataAcknowledgementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const arrivedFromOnboarding = Boolean((location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding);
  const [transitionCurtainVisible, setTransitionCurtainVisible] = useState(arrivedFromOnboarding);
  const [isLeavingOnboarding, setIsLeavingOnboarding] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get("manage") === "data-acknowledgement");
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [copied, setCopied] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [acknowledged, setAcknowledged] = useState(loadDataAcknowledgement);

  const canEncrypt = Boolean(encryptionKey && recoveryPhrase.trim());

  useEffect(() => {
    if (!arrivedFromOnboarding) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setTransitionCurtainVisible(false));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [arrivedFromOnboarding]);

  useEffect(() => {
    void fetch("/storage/status")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not verify secure local storage.");
        return response.json() as Promise<{ encrypted: boolean; recovery_confirmed: boolean; acknowledged: boolean }>;
      })
      .then((status) => {
        setEncrypted(status.recovery_confirmed);
        if (status.acknowledged) {
          if (!loadDataAcknowledgement()) saveDataAcknowledgement();
        } else {
          clearDataAcknowledgement();
        }
        setAcknowledged(status.acknowledged);
      })
      .catch((error: unknown) => setStorageError(error instanceof Error ? error.message : "Could not verify secure local storage."));
  }, []);

  useEffect(() => () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
  }, []);

  function enterAlongside(path: string) {
    if (isLeavingOnboarding) return;
    setIsLeavingOnboarding(true);
    setTransitionCurtainVisible(true);
    leaveTimer.current = window.setTimeout(() => {
      navigate(path, { state: { fromOnboarding: true } });
    }, 700);
  }

  async function copyKey() {
    if (!encryptionKey) return;
    await navigator.clipboard?.writeText(encryptionKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function deleteKey() {
    setEncryptionKey(null);
    setRecoveryPhrase("");
    setEncrypted(false);
  }

  async function generateRecoveryPhrase() {
    setStorageError(null);
    const response = await fetch("/storage/recovery-phrase", { method: "POST" });
    if (!response.ok) {
      setStorageError("Could not access the encryption key in your OS keychain.");
      return;
    }
    const body = await response.json() as { recovery_phrase: string };
    setEncryptionKey(body.recovery_phrase);
  }

  async function configureEncryption() {
    if (!canEncrypt) return;
    setStorageError(null);
    const response = await fetch("/storage/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recovery_phrase: recoveryPhrase.trim() }),
    });
    if (!response.ok) {
      setStorageError(response.status === 422 ? "The recovery phrase does not match. Copy it exactly and try again." : "Could not confirm secure local storage.");
      return;
    }
    setEncrypted(true);
    setActiveStep(2);
  }

  async function acknowledgeData() {
    const response = await fetch("/storage/acknowledge", { method: "POST" });
    if (!response.ok) {
      setStorageError("Confirm and save your recovery phrase before continuing.");
      setActiveStep(1);
      return;
    }
    saveDataAcknowledgement();
    setAcknowledged(true);
    setDialogOpen(false);
  }

  function returnToIntroduction() {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    navigate("/", { replace: true });
  }

  return (
    <main className="relative min-h-dvh overflow-y-auto bg-background text-foreground">
      {(arrivedFromOnboarding || isLeavingOnboarding) && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-[100] bg-background transition-opacity duration-700 ease-in-out ${transitionCurtainVisible ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {acknowledged && (
        <button
          type="button"
          aria-label="Close Getting started"
          disabled={isLeavingOnboarding}
          onClick={() => enterAlongside("/new/chat")}
          className="absolute top-5 right-5 z-10 rounded-lg p-2 text-muted-foreground transition hover:bg-hover-2/50 hover:text-foreground sm:top-7 sm:right-7"
        >
          <X className="size-5" />
        </button>
      )}
      <div className="absolute top-1/2 left-1/2 w-full max-w-[800px] -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="mx-auto w-full max-w-[640px]">
          <AlongsideLogo className="mx-auto size-[32px] text-black dark:text-white" />

          <div className="mx-auto mt-6 max-w-[390px] text-center">
            <h1 className="text-[18px] font-normal text-foreground">Getting started</h1>
            <p className="mt-2 text-[13px] font-normal text-muted-foreground">
              {acknowledged
                ? "The required setup is complete. Explore the recommended steps or close this page to start using Alongside."
                : "Complete the required step to continue. You can return to Getting Started at any time to review the recommended steps."}
            </p>
          </div>

          <div className="mx-auto mt-6 w-full max-w-[390px]">
            <GettingStartedRows
              actionsEnabled={acknowledged}
              acknowledgement={{ complete: acknowledged, onManage: () => setDialogOpen(true) }}
              onSetupProvider={() => enterAlongside("/settings/provider")}
              onCreateChat={() => enterAlongside("/new/chat")}
            />
          </div>

          <div className="mx-auto mt-8 max-w-[390px] text-center">
            <button
              type="button"
              onClick={returnToIntroduction}
              className="text-xs text-muted-foreground opacity-20 underline underline-offset-2 transition-opacity hover:opacity-60 focus-visible:opacity-60"
            >
              Return to previous page
            </button>
          </div>
        </div>
      </div>

      <SetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Acknowledge your data"
        description="Your conversations are stored locally in an encrypted SQLCipher database. Alongside uses a key held by your OS keychain to access them."
        contentClassName="space-y-5"
      >
              <div className="relative pl-10">
                <button
                  type="button"
                  aria-expanded={activeStep === 1}
                  aria-label="Expand Encrypt your data"
                  onClick={() => setActiveStep(1)}
                  className={`absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border-2 text-xs transition ${activeStep === 1 ? "border-focus-accent text-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}
                >
                  1
                </button>
                <span className="absolute top-10 bottom-[-1.25rem] left-[15px] border-l border-dashed border-border" />
                <h3 className="pt-1 text-base font-medium">
                  Encrypt your data
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">Required</span>
                </h3>
                <div
                  aria-hidden={activeStep !== 1}
                  inert={activeStep !== 1}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${activeStep === 1 ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                  <div className="mt-1.5">
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      Alongside encrypts local data with SQLCipher. Save this recovery phrase somewhere secure: Alongside cannot restore your data without it if your OS keychain is lost.
                    </p>

                    <div className="mt-3 space-y-2">
                      <div>
                        <button
                          type="button"
                          disabled={Boolean(encryptionKey)}
                          onClick={() => void generateRecoveryPhrase()}
                          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <KeyRound className="size-4" /> Generate your recovery phrase
                        </button>
                        {encryptionKey && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-background/60 p-2">
                            <code className="min-w-0 flex-1 break-all text-[10px] leading-3.5 text-foreground/75">{encryptionKey}</code>
                            <button type="button" onClick={copyKey} aria-label="Copy encryption key" className="rounded-md p-1.5 text-muted-foreground hover:bg-hover-2/50 hover:text-foreground">
                              <Copy className="size-4" />
                            </button>
                            <button type="button" onClick={deleteKey} aria-label="Delete encryption key" className="rounded-md p-1.5 text-muted-foreground hover:bg-red-400/10 hover:text-red-500 dark:hover:text-red-200">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                        {copied && <p className="mt-2 text-xs text-emerald-300">Key copied</p>}
                      </div>

                      <label className="block text-xs text-foreground/75">
                        <span>Confirm your recovery phrase</span>
                        <input
                          type="password"
                          value={recoveryPhrase}
                          onChange={(event) => setRecoveryPhrase(event.target.value)}
                          disabled={!encryptionKey}
                          placeholder="Paste the saved recovery phrase"
                          className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-focus-accent disabled:cursor-not-allowed disabled:opacity-45"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={!canEncrypt || encrypted}
                        onClick={() => void configureEncryption()}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-hover-2/50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {encrypted ? "Encrypted storage confirmed" : "Confirm encrypted storage"}
                      </button>
                      {activeStep === 1 && storageError && <p role="alert" className="text-[11px] text-red-500 dark:text-red-300">{storageError}</p>}
                    </div>
                  </div>
                  </div>
                </div>
              </div>

              <div className="relative pl-10">
                <button
                  type="button"
                  aria-expanded={activeStep === 2}
                  aria-label="Expand I acknowledge my data"
                  onClick={() => setActiveStep(2)}
                  className={`absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border-2 text-xs transition ${activeStep === 2 ? "border-focus-accent text-foreground" : acknowledged ? "border-emerald-500 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground hover:border-foreground/40"}`}
                >
                  2
                </button>
                <h3 className="pt-1 text-base font-medium">
                  I acknowledge my data
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">Required</span>
                </h3>
                <div
                  aria-hidden={activeStep !== 2}
                  inert={activeStep !== 2}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${activeStep === 2 ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                  <div className="mt-1.5">
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      You are responsible for safeguarding your key, recovery phrase, and local data. Alongside cannot recover lost credentials or inaccessible data. You can review this data acknowledgement in Settings.
                    </p>
                    {storageError && <p role="alert" className="mt-2 text-[11px] text-red-500 dark:text-red-300">{storageError}</p>}
                    <button
                      type="button"
                      disabled={!encrypted}
                      onClick={() => void acknowledgeData()}
                      className="mt-3 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      I acknowledge
                    </button>
                  </div>
                  </div>
                </div>
              </div>
      </SetupDialog>
    </main>
  );
}
