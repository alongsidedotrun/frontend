import { ShieldCheck } from "lucide-react";
import { ComputerProgrammingIcon, DocIcon, PlusIcon } from "@/components/icons/untitled-ui";
import { Card, CardDescription, CardGroup, CardHeader, CardMedia, CardTitle } from "@/components/ui/card";
import { SizeProvider } from "@/lib/size-context";

type GettingStartedRowsProps = {
  actionsEnabled?: boolean;
  onSetupProvider: () => void;
  onCreateChat: () => void;
  acknowledgement?: {
    complete: boolean;
    onManage: () => void;
  };
};

function Status({ children }: { children: string }) {
  return <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">{children}</span>;
}

/** Shared action rows for both onboarding and the in-app Getting Started page. */
export function GettingStartedRows({
  actionsEnabled = true,
  onSetupProvider,
  onCreateChat,
  acknowledgement,
}: GettingStartedRowsProps) {
  return (
    <SizeProvider size="compact">
      <CardGroup
        orientation="inline"
        border="outlined"
        separated
        highlightClassName="rounded-[7px] bg-hover-2/50"
        divided={false}
        className="gap-1"
      >
        {acknowledgement && (
          <Card
            label="Acknowledge your data"
            onClick={acknowledgement.onManage}
            className={`min-h-9 transition-colors ${acknowledgement.complete ? "!border-focus-accent" : ""}`}
          >
            <CardMedia icon={ShieldCheck} className="size-5" />
            <CardHeader className="py-1.5">
              <CardTitle>
                Acknowledge your data
                <Status>Required</Status>
              </CardTitle>
              <CardDescription>
                {acknowledgement.complete ? "Data responsibility confirmed." : "Review how your local data is stored and protected."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card
          disabled={!actionsEnabled}
          label="Setup your AI provider"
          onClick={onSetupProvider}
          className="min-h-9 transition-opacity"
        >
          <CardMedia icon={ComputerProgrammingIcon} className="size-5" />
          <CardHeader className="py-1.5">
            <CardTitle>
              Setup your AI provider
              <Status>Recommended</Status>
            </CardTitle>
            <CardDescription>Connect a provider and use its models.</CardDescription>
          </CardHeader>
        </Card>

        <Card
          disabled={!actionsEnabled}
          label="Create a new chat"
          onClick={onCreateChat}
          className="min-h-9 transition-opacity"
        >
          <CardMedia icon={PlusIcon} className="size-5" />
          <CardHeader className="py-1.5">
            <CardTitle>
              Create a new chat
              <Status>Optional</Status>
            </CardTitle>
            <CardDescription>Start a conversation using a configured AI provider.</CardDescription>
          </CardHeader>
        </Card>

        <Card disabled label="Learn the features" className="min-h-9">
          <CardMedia icon={DocIcon} className="size-5" />
          <CardHeader className="py-1.5">
            <CardTitle>
              Learn the features
              <Status>Coming Soon</Status>
            </CardTitle>
            <CardDescription>Discover what you can do with Alongside.</CardDescription>
          </CardHeader>
        </Card>
      </CardGroup>
    </SizeProvider>
  );
}
