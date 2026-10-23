import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Star01, Trash01 } from "@untitledui/icons";
import { PageContent } from "@/components/page-content";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ShapeProvider } from "@/lib/shape-context";
import { BotFace } from "@/components/bot-face";
import { NewAgentDialog } from "@/components/new-agent-dialog";
import { useBots, type Bot } from "@/lib/bots";
import { fade } from "@/lib/springs";
import { cn } from "@/lib/utils";

// Same pill segmented control as Settings > Skills.
const TAB_CLASS = "h-[22px] px-2.5 [&>span]:!text-[12px] [&>span]:!leading-none";

/**
 * Bots (#504), from the sidebar under Join chat: the specialists you've made, and the ones you've
 * favourited. In a chat, /include @name brings one in.
 */
export function BotsPage() {
  const { t } = useTranslation();
  const { bots, add, remove, toggleFavourite } = useBots();
  const [tab, setTab] = useState<"yours" | "favourites">("yours");
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    document.title = t("bots.title");
  }, [t]);

  const shown = tab === "favourites" ? bots.filter((bot) => bot.favourite) : bots;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-6 py-5">
        <PageContent maxWidth="var(--chat-max-width)">
          <div className="@container flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-foreground">{t("bots.title")}</h2>
                <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">{t("bots.subtitle")}</p>
              </div>
              <Button size="compact" variant="primary" leadingIcon={Plus} onClick={() => setNewOpen(true)}>{t("bots.new")}</Button>
            </div>

            <div className="mt-5">
              <ShapeProvider defaultShape="pill">
                <Tabs size="compact" value={tab} onValueChange={(value) => setTab(value as "yours" | "favourites")}>
                  <TabsList className="[&>div:first-child]:!bg-background [&>div:first-child]:!shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] dark:[&>div:first-child]:!bg-white/12">
                    <TabItem value="yours" label={t("bots.tabs.yours")} className={TAB_CLASS} />
                    <TabItem value="favourites" label={t("bots.tabs.favourites")} className={TAB_CLASS} />
                  </TabsList>
                </Tabs>
              </ShapeProvider>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={tab}
                className="mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: fade }}
                exit={{ opacity: 0, transition: fade }}
              >
                {shown.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 @[440px]:grid-cols-2 @[640px]:grid-cols-3">
                    {shown.map((bot) => (
                      <BotCard key={bot.id} bot={bot} onFavourite={() => toggleFavourite(bot.id)} onRemove={() => remove(bot.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-10 text-center text-[length:var(--redesign-chat-text)] text-muted-foreground">
                    <BotFace expression={tab === "favourites" ? "sleeping" : "default"} className="size-10" />
                    {t(tab === "favourites" ? "bots.empty.favourites" : "bots.empty.yours")}
                  </div>
                )}
              </motion.section>
            </AnimatePresence>
          </div>
        </PageContent>
      </ScrollArea>

      <NewAgentDialog
        kind="bot"
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onAdd={async (name, instructions, avatar) => {
          const failed = await add(name, instructions, avatar);
          if (!failed) setTab("yours");
          return failed;
        }}
      />
    </div>
  );
}

function BotCard({ bot, onFavourite, onRemove }: { bot: Bot; onFavourite: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const iconButton = "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <article className="group/bot flex min-h-[124px] flex-col rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <BotFace avatar={bot.avatar} className="size-7" />
        <h4 className="min-w-0 flex-1 truncate text-[length:var(--redesign-chat-text)] font-medium text-foreground">@{bot.name}</h4>
        <button type="button" aria-label={t("bots.remove", { name: bot.name })} onClick={onRemove} className={cn(iconButton, "opacity-0 group-hover/bot:opacity-100 focus-visible:opacity-100")}>
          <Trash01 aria-hidden="true" className="size-3.5" />
        </button>
        <button type="button" aria-label={t("bots.favourite", { name: bot.name })} aria-pressed={bot.favourite} onClick={onFavourite} className={iconButton}>
          <Star01 aria-hidden="true" className={cn("size-3.5", bot.favourite && "fill-amber-400 text-amber-400")} />
        </button>
      </div>
      <p className="mt-2 line-clamp-3 text-[length:var(--redesign-chat-meta)] leading-[1.5] text-muted-foreground">{bot.instructions}</p>
    </article>
  );
}
