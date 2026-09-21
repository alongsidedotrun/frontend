import { useTranslation } from "react-i18next";
import { DefaultAvatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresence } from "@/lib/presence";

// The people in this chat, in the header (Epic #383, story #384): an avatar each, with a dot for
// whether they are online now and a tooltip with their name and role. Only shown once someone else
// is in the chat, so a solo chat looks exactly as it did.
export function PresenceStack() {
  const { t } = useTranslation();
  const people = usePresence();
  if (people.length < 2) return null;

  return (
    <div className="flex items-center -space-x-1.5" role="group" aria-label={t("presence.label")}>
      {people.map((person) => (
        <Tooltip key={person.name}>
          <TooltipTrigger asChild>
            <span className={`relative size-6 rounded-full ring-2 ring-background ${person.online ? "" : "opacity-45"}`}>
              <DefaultAvatar name={person.name} />
              <span
                aria-hidden
                className={`absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-background ${person.online ? "bg-emerald-500" : "bg-muted-foreground/60"}`}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {person.name} · {t(`share.role.${person.role}`)} · {person.online ? t("presence.online") : t("presence.offline")}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
