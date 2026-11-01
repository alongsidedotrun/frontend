import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ShapeProvider } from "@/lib/shape-context";
import { MoreTrigger } from "@/components/ui/more-trigger";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { useIsSignedIn } from "@/lib/auth";
import { ErrorText } from "@/lib/error-code";
import { SHARE_ERRORS } from "@/lib/use-share";
import { useJoinRequests, type WaitingJoin } from "@/lib/use-join-requests";
import { openSignInDialog } from "@/lib/use-sign-in";
import { cn } from "@/lib/utils";

type Status = { syncing: boolean; chat_id: string | null; shared_before?: boolean };
type JoinCode = { code?: string; status: "active" | "expired" | "used"; expires_at: number; role?: Role } | null;
type Role = "admin" | "editor" | "participant" | "reader";
type Member = { id: string; name: string; role: "owner" | Role; online: boolean };
// Manage members' changes until Save: a new role per member id, and who to remove.
type MemberEdits = { roles: Record<string, Role>; removals: string[] };
const NO_EDITS: MemberEdits = { roles: {}, removals: [] };
const hasEdits = (edits: MemberEdits) => edits.removals.length > 0 || Object.keys(edits.roles).length > 0;
type Phase = "loading" | "ready" | "disclosure";
// Not shared yet; pending (shared, nobody let in yet); shared (someone has joined).
type ChatState = "notShared" | "pending" | "shared";

// While open and sharing, the code's status and who has joined are re-read
// this often, so a code being used shows up without reopening.
const REFRESH_MS = 5000;

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function errorKeyOf(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return SHARE_ERRORS[body.error ?? ""] ?? fallback;
}

/**
 * Invite members (#213, #459): the chat ID, the role (Read, Commenter,
 * Contributor or Admin) and Invite. The first Invite
 * shares the chat (after the relay disclosure, once, #409): it's pending until
 * someone is let in, then shared. Each Invite makes a join code for the role
 * (single use, 15 minutes) and copies an invite with the chat ID and code.
 * Below: who has access and who is waiting to join (Join chat dialog).
 */
export function ShareChatDialog({ sessionId, open, onOpenChange }: { sessionId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<JoinCode>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"id" | "code" | "invite" | null>(null);
  // What the next code lets someone in as.
  const [role, setRole] = useState<Role>("editor");
  // New invite, or managing who's in and who's waiting.
  const [tab, setTab] = useState<"invite" | "manage">("invite");
  // Manage members' unsaved changes: new roles and removals, applied on Save.
  const [edits, setEdits] = useState<MemberEdits>(NO_EDITS);
  const [now, setNow] = useState(nowSeconds);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharing = Boolean(status?.syncing);
  // #460: people who asked to join this chat and are waiting for someone to let them in.
  const waiting = useJoinRequests(sessionId, open && sharing);

  const refreshAccess = useCallback(async () => {
    if (!sessionId) return;
    const [codeResponse, membersResponse] = await Promise.all([
      fetch(`/sessions/${sessionId}/relay/code`).catch(() => null),
      fetch(`/sessions/${sessionId}/relay/members`).catch(() => null),
    ]);
    if (codeResponse?.ok) setCode((await codeResponse.json()) as JoinCode);
    if (membersResponse?.ok) setMembers((await membersResponse.json()) as Member[]);
  }, [sessionId]);

  const load = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const current = (await (await fetch(`/sessions/${sessionId}/relay/status`)).json()) as Status;
      setStatus(current);
      if (current.syncing) await refreshAccess();
      return current;
    } catch {
      setError(t("shareChat.errors.start"));
      return null;
    } finally {
      setPhase((previous) => (previous === "disclosure" ? previous : "ready"));
    }
  }, [sessionId, refreshAccess, t]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDisclosure(null);
    setCode(null);
    setMembers([]);
    setTab("invite");
    setEdits(NO_EDITS);
    setPhase("loading");
    void load();
  }, [open, load, signedIn]);

  // Keep "People with access" and the code's status current while sharing.
  useEffect(() => {
    if (!open || !sharing) return;
    const timer = setInterval(() => void refreshAccess(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, sharing, refreshAccess]);

  // The code's countdown.
  const codeActive = code?.status === "active" && code.expires_at > now;
  useEffect(() => {
    if (!open || code?.status !== "active") return;
    setNow(nowSeconds());
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(timer);
  }, [open, code]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // Shares the chat under the chat ID already shown, returning it, or null
  // when it couldn't (the disclosure to agree to first, sign-in, or an error,
  // all shown). A chat shared before reconnects under its chat ID, so people
  // who joined earlier stay linked; if the relay has since dropped it (nobody
  // connected for a while), it gets a new one.
  async function share(acknowledged: boolean): Promise<string | null> {
    if (!sessionId) return null;
    for (const resume of status?.shared_before && status.chat_id ? [true, false] : [false]) {
      const response = await fetch(`/sessions/${sessionId}/relay/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(resume ? { relay_session_id: status!.chat_id } : {}),
          ...(acknowledged ? { acknowledged_disclosure: true } : {}),
        }),
      });
      if (response.status === 428) {
        const body = (await response.json().catch(() => ({}))) as { disclosure?: string };
        setDisclosure(body.disclosure ?? null);
        setPhase("disclosure");
        return null;
      }
      if (response.status === 401) {
        openSignInDialog();
        return null;
      }
      if (!response.ok) {
        setError(t(await errorKeyOf(response, "shareChat.errors.start")));
        return null;
      }
      const current = await load();
      if (current?.syncing && current.chat_id) return current.chat_id;
    }
    setError(t("shareChat.errors.start"));
    return null;
  }

  async function stop() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await fetch(`/sessions/${sessionId}/relay/stop`, { method: "POST" });
      setCode(null);
      setMembers([]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Invite: shares the chat if it isn't yet, then a fresh single-use code for
  // the chosen role (replacing any live one), copied with the chat ID as a
  // message ready to send.
  function invite(acknowledged = false) {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const made = (async () => {
      const chatId = status?.syncing && status.chat_id ? status.chat_id : await share(acknowledged);
      if (!chatId) return null;
      setDisclosure(null);
      setPhase("ready");
      const response = await fetch(`/sessions/${sessionId}/relay/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        setError(t(await errorKeyOf(response, "shareChat.errors.code")));
        return null;
      }
      const code = (await response.json()) as { code: string; expires_at: number; role?: Role };
      setCode({ code: code.code, status: "active", expires_at: code.expires_at, role: code.role ?? role });
      return t("shareChat.inviteText", { chatId, code: code.code });
    })()
      .catch(() => {
        setError(t("shareChat.errors.code"));
        return null;
      })
      .finally(() => setBusy(false));
    copyWhenReady("invite", made);
  }

  // Save on Manage members: removes who was marked (the relay disconnects
  // them at once and they can't come back without a new code; what they
  // already have stays on their device), then changes roles. Whatever fails
  // stays marked, with its error.
  async function save() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    const left: MemberEdits = { roles: {}, removals: [] };
    const memberPath = (id: string) => `/sessions/${sessionId}/relay/members/${encodeURIComponent(id)}`;
    for (const id of edits.removals) {
      const response = await fetch(memberPath(id), { method: "DELETE" }).catch(() => null);
      if (!response?.ok) {
        left.removals.push(id);
        setError(t("shareChat.errors.remove", { name: members.find((m) => m.id === id)?.name ?? id }));
      }
    }
    for (const [id, role] of Object.entries(edits.roles)) {
      if (edits.removals.includes(id)) continue;
      const response = await fetch(memberPath(id), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }).catch(() => null);
      if (!response?.ok) {
        left.roles[id] = role;
        setError(t("shareChat.errors.role", { name: members.find((m) => m.id === id)?.name ?? id }));
      }
    }
    setMembers((current) => current.filter((m) => !edits.removals.includes(m.id) || left.removals.includes(m.id)));
    setEdits(left);
    await refreshAccess();
    setBusy(false);
  }

  async function decideJoin(request: WaitingJoin, action: "approve" | "deny") {
    setError(null);
    if (!(await waiting.decide(request, action))) setError(t("joinRequests.errors.decide", { name: request.name }));
    await refreshAccess();
  }

  async function revokeCode() {
    if (!sessionId) return;
    await fetch(`/sessions/${sessionId}/relay/code`, { method: "DELETE" }).catch(() => null);
    setCode(null);
    await refreshAccess();
  }

  function markCopied(kind: "id" | "code" | "invite") {
    setCopied(kind);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), kind === "invite" ? 4000 : 1500);
  }

  function copy(kind: "id" | "code", value: string) {
    void navigator.clipboard?.writeText(value).then(() => markCopied(kind));
  }

  // Copies text that's still being made. WebKit (the desktop app) only lets a
  // click write to the clipboard right away, so the write starts now with the
  // text to follow; elsewhere it's written once ready.
  function copyWhenReady(kind: "invite", text: Promise<string | null>) {
    const done = () => markCopied(kind);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const blob = text.then((value) => {
        if (value === null) throw new Error("nothing to copy");
        return new Blob([value], { type: "text/plain" });
      });
      void navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(done, () => undefined);
      return;
    }
    void text.then((value) => {
      if (value !== null) void navigator.clipboard?.writeText(value).then(done);
    });
  }

  const minutesLeft = code ? Math.max(1, Math.ceil((code.expires_at - now) / 60)) : 0;
  const state: ChatState = !sharing ? "notShared" : members.length > 1 ? "shared" : "pending";

  return (
    <ShellDialog
      open={open}
      onOpenChange={onOpenChange}
      top={
        signedIn && (
          // Pill segmented control, like Library / Recents.
          <ShapeProvider defaultShape="pill">
            <Tabs size="compact" value={tab} onValueChange={(value) => setTab(value as "invite" | "manage")} className="self-center">
              {/* The selected tab (the list's first child) as a white pill with a light shadow, like Library / Recents. */}
              <TabsList>
                <TabItem value="invite" label={t("shareChat.tabs.invite")} />
                <TabItem value="manage" label={t("shareChat.tabs.manage")} />
              </TabsList>
            </Tabs>
          </ShapeProvider>
        )
      }
      title={t("shareChat.title")}
      badge={
        // Pending or Shared; nothing until the chat is shared.
        signedIn && phase !== "loading" && state !== "notShared" && (
          <span className="flex h-5 items-center gap-1.5 rounded-full border border-[var(--redesign-sidebar-border)] px-2 text-ui-xs text-foreground">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", state === "shared" ? "bg-emerald-500" : "bg-amber-500")} />
            {t(`shareChat.state.${state}`)}
          </span>
        )
      }
      description={t(tab === "manage" ? "shareChat.manageDescription" : "shareChat.description")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={() => onOpenChange(false)}
          primary={
            signedIn && phase === "ready"
              ? // Invite on New invite; Save (the member changes) on Manage members.
                { label: t(tab === "invite" ? "shareChat.invite" : "common.save"), disabled: busy || (tab === "manage" && !hasEdits(edits)), onClick: () => (tab === "invite" ? invite() : void save()) }
              : undefined
          }
        />
      }
    >
      {/* Both pages share one grid cell, so the dialog keeps the taller one's size on either tab. */}
      <div className="grid">
      <div className={cn(PAGE_CLASS, tab !== "invite" && "pointer-events-none opacity-0")} aria-hidden={tab !== "invite" || undefined} inert={tab !== "invite" || undefined}>
      {!signedIn ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-ui-sm text-muted-foreground">{t("shareChat.signIn")}</p>
          <Button type="button" variant="primary" size="compact" onClick={openSignInDialog}>
            {t("shareChat.signInButton")}
          </Button>
        </div>
      ) : phase === "disclosure" ? (
        <div className={cn("flex flex-col gap-3 p-4", SHELL_RADIUS, SHELL_SURFACE)}>
          <h3 className="text-ui font-medium text-foreground">{t("share.disclosure.title")}</h3>
          <p className="text-ui-sm text-muted-foreground">{disclosure}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="tertiary" size="compact" disabled={busy} onClick={() => { setDisclosure(null); setPhase("ready"); }}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="accent" size="compact" disabled={busy} onClick={() => invite(true)}>
              {t("shareChat.agreeInvite")}
            </Button>
          </div>
        </div>
      ) : phase === "ready" ? (
        <div className="flex flex-col gap-3">
          {/* The identifier (chat ID), and under it the join code once Invite has made one. */}
          <div className="flex flex-col gap-2">
            <CopyField label={t("shareChat.chatId")} value={status?.chat_id ?? null} copied={copied === "id"} onCopy={(value) => copy("id", value)} />
            <CopyField
              label={t("shareChat.joinCode")}
              value={sharing && codeActive && code?.code ? code.code : null}
              placeholder={t("shareChat.joinCodePending")}
              copied={copied === "code"}
              onCopy={(value) => copy("code", value)}
            />
          </div>
          {sharing && codeActive && code?.code ? (
            <p className="flex items-center gap-1 text-ui-sm text-muted-foreground">
              {copied === "invite" ? (
                <span role="status" className="text-foreground">{t("shareChat.inviteCopied")}</span>
              ) : (
                <span>{t(`shareChat.role.${code.role ?? "editor"}`)} · {t("shareChat.codeExpires", { count: minutesLeft })}</span>
              )}
              <button type="button" onClick={() => void revokeCode()} className="ml-auto underline-offset-2 transition-colors hover:text-foreground hover:underline">
                {t("shareChat.access.revoke")}
              </button>
            </p>
          ) : copied === "invite" ? (
            <p role="status" className="text-ui-sm text-foreground">{t("shareChat.inviteCopied")}</p>
          ) : sharing && codeActive ? (
            <p className="text-ui-sm text-muted-foreground">{t("shareChat.codeHidden")}</p>
          ) : null}
          <RolePicker role={role} onChange={setRole} />
        </div>
      ) : null}

      </div>
      {/* Manage members: who's in and who's waiting, empty or not. */}
      {signedIn && (
        <div className={cn(PAGE_CLASS, tab !== "manage" && "pointer-events-none opacity-0")} aria-hidden={tab !== "manage" || undefined} inert={tab !== "manage" || undefined}>
          <WhoHasAccess members={members} waiting={waiting.requests} edits={edits} onEdit={setEdits} onStop={sharing ? () => void stop() : undefined} stopping={busy} onDecide={(request, action) => void decideJoin(request, action)} />
        </div>
      )}
      </div>

      {/* Either page's error, outside both so it shows on the tab that caused it. */}
      {error && (
        <p role="alert" className="-mt-2 text-ui-sm text-destructive">
          <ErrorText message={error} />
        </p>
      )}
    </ShellDialog>
  );
}

// A tab's page: both share one grid cell and cross-fade when switching.
const PAGE_CLASS = "col-start-1 row-start-1 flex min-w-0 flex-col gap-3 transition-opacity duration-160 ease-out";

// A notch under the compact tabs: 22px, 12px text.

// Lowest first: each role includes the ones below it.
const ROLES: Role[] = ["reader", "participant", "editor", "admin"];

/**
 * What the next invite lets someone do, as checks that build from the bottom
 * up: Read, then Commenter (Read and sending messages), then Contributor
 * (all of that and running their own agent), then Admin (all of that and
 * inviting, letting people in and managing members below Admin; only the
 * owner makes admins). Read is always on.
 */
function RolePicker({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  const { t } = useTranslation();
  const level = ROLES.indexOf(role);
  return (
    <div className={cn("flex flex-col gap-1 p-1.5 pt-1", SHELL_RADIUS, SHELL_SURFACE)}>
      {/* Headed like the sidebar's Projects and Chats. */}
      <span className="flex h-5 items-center px-[var(--redesign-quick-actions-padding)] text-ui-xs font-medium text-muted-foreground">{t("shareChat.roles")}</span>
      {/* One background for all three, its corner nested inside the card's (STYLE_GUIDE.md: corner radius). */}
      <ul className="flex flex-col rounded-[calc(32px*8/27-3px)] bg-[var(--redesign-sidebar-surface)] py-1">
        {[...ROLES].reverse().map((option) => {
          const index = ROLES.indexOf(option);
          const checked = index <= level;
          const id = `share-role-${option}`;
          return (
            <li key={option} className="flex items-start gap-2.5 px-3 py-2">
              <Checkbox
                id={id}
                checked={checked}
                disabled={option === "reader"}
                // Checking a role takes in the ones below it; unchecking one steps down to the one below.
                onCheckedChange={(next) => onChange(next ? option : ROLES[Math.max(0, index - 1)])}
                className="mt-[3px] size-3 rounded-[3px] [&_svg]:!size-2.5 border-muted-foreground/40 data-checked:border-[var(--send-button-bg)] data-checked:bg-[var(--send-button-bg)] data-checked:text-white disabled:opacity-100 dark:data-checked:bg-[var(--send-button-bg)]"
              />
              <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-ui-sm font-medium text-foreground">{t(`shareChat.role.${option}`)}</span>
                <span className="text-ui-xs text-muted-foreground">{t(`shareChat.roleHint.${option}`)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The identifier or join code, labelled, with a copy button; a placeholder until there is one. */
function CopyField({ label, value, placeholder, copied, onCopy }: { label: string; value: string | null; placeholder?: string; copied: boolean; onCopy: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <ShellField
      label={label}
      trailing={
        <Button type="button" variant="ghost" size="icon-compact" className="size-6" disabled={!value} aria-label={copied ? t("shareChat.copied") : t("shareChat.copy", { what: label })} onClick={() => value && onCopy(value)}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      }
    >
      {value ? (
        <span className="min-w-0 flex-1 truncate font-mono tracking-[0.1em] text-foreground select-all">{value}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-ui-sm text-muted-foreground/70">{placeholder}</span>
      )}
    </ShellField>
  );
}

/** Initials in a circle: solid for people in the chat, dashed for people waiting. */
function Avatar({ name, waiting = false, online }: { name: string; waiting?: boolean; online?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
  return (
    <span
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-full text-ui-xs font-medium text-foreground",
        waiting ? "border border-dashed border-muted-foreground/50" : "bg-muted",
      )}
    >
      {initials}
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-[var(--redesign-primary-surface)]", online ? "bg-emerald-500" : "bg-muted-foreground/40")}
        />
      )}
    </span>
  );
}

// 36px rows, 8px apart: the list is one row tall when empty and scrolls past 4 (4 × 36 + 3 × 8).
const ROW_CLASS = "flex h-9 shrink-0 items-center gap-2.5";
const LIST_CLASS = "flex max-h-[168px] min-h-9 flex-col gap-2 overflow-y-auto";

function NoMembers() {
  const { t } = useTranslation();
  return <li className="flex h-9 items-center text-ui-sm text-muted-foreground">{t("shareChat.access.noMembers")}</li>;
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-ui font-medium text-foreground">{children}</h3>
      {action}
    </div>
  );
}

/**
 * People with access (name, online or not, role, "…" to remove) and those
 * waiting for confirmation. Both always show, empty or not; past 4 people a
 * list scrolls.
 */
function WhoHasAccess({
  members,
  waiting,
  edits,
  onEdit,
  onDecide,
  onStop,
  stopping,
}: {
  members: Member[];
  waiting: WaitingJoin[];
  edits: MemberEdits;
  onEdit: (edits: MemberEdits) => void;
  onDecide: (request: WaitingJoin, action: "approve" | "deny") => void;
  /** Stop sharing, while shared. */
  onStop?: () => void;
  stopping?: boolean;
}) {
  const { t } = useTranslation();
  const setRole = (member: Member, role: Role) => {
    const roles = { ...edits.roles };
    if (role === member.role) delete roles[member.id];
    else roles[member.id] = role;
    onEdit({ ...edits, roles });
  };
  const toggleRemoval = (member: Member) =>
    onEdit({ ...edits, removals: edits.removals.includes(member.id) ? edits.removals.filter((id) => id !== member.id) : [...edits.removals, member.id] });
  return (
    <>
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          action={
            onStop && (
              <button type="button" disabled={stopping} onClick={onStop} className="text-ui-sm text-destructive underline-offset-2 hover:underline disabled:opacity-50">
                {t("shareChat.stop")}
              </button>
            )
          }
        >
          {t("shareChat.access.title")}
        </SectionTitle>
        <ul className={LIST_CLASS}>
          {members.length === 0 && <NoMembers />}
          {members.map((member) => {
            const removing = edits.removals.includes(member.id);
            return (
              <li key={member.id} className={cn(ROW_CLASS, removing && "opacity-60")}>
                <Avatar name={member.name} online={member.online} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate text-ui text-foreground", removing && "line-through")}>{member.name}</span>
                  <span className="truncate text-ui-xs text-muted-foreground">
                    {removing ? t("shareChat.access.removing") : member.online ? t("presence.online") : t("presence.offline")}
                  </span>
                </span>
                {member.role === "owner" ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-6 items-center rounded-full border border-[var(--redesign-sidebar-border)] px-2.5 text-ui-xs text-foreground">{t("share.role.host")}</span>
                    <span aria-hidden="true" className="size-5" />
                  </span>
                ) : removing ? (
                  <Button type="button" variant="ghost" size="compact" onClick={() => toggleRemoval(member)}>
                    {t("shareChat.access.undo")}
                  </Button>
                ) : (
                  <span className="flex shrink-0 items-center gap-2">
                    <Select value={edits.roles[member.id] ?? member.role} onValueChange={(value) => setRole(member, value as Role)}>
                      <SelectTrigger size="compact" aria-label={t("shareChat.access.roleFor", { name: member.name })} className="h-6 w-auto gap-1 rounded-full px-2.5 text-ui-xs" />
                      <SelectContent positionerClassName="!z-[130]">
                        {[...ROLES].reverse().map((role, index) => (
                          <SelectItem key={role} value={role} index={index}>{t(`shareChat.role.${role}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <MoreTrigger autoHide={false} aria-label={t("shareChat.access.removeName", { name: member.name })} onClick={() => toggleRemoval(member)} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t("shareChat.access.waiting")}</SectionTitle>
        <ul className={LIST_CLASS}>
          {waiting.length === 0 && <NoMembers />}
          {waiting.map((request) => (
            <li key={request.request_id} className={ROW_CLASS}>
              <Avatar name={request.name} waiting />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui text-foreground">{request.name}</span>
                <span className="truncate text-ui-xs text-muted-foreground">{t("shareChat.access.asked")}</span>
              </span>
              <Button type="button" variant="ghost" size="compact" onClick={() => onDecide(request, "deny")}>
                {t("joinRequests.deny")}
              </Button>
              <Button type="button" variant="primary" size="compact" onClick={() => onDecide(request, "approve")}>
                {t("joinRequests.letIn")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
