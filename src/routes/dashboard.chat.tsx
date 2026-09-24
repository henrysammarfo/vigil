import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/vigil/dashboard-shell";
import { DeskChatApp } from "@/components/vigil/desk-chat/DeskChatApp";

export const Route = createFileRoute("/dashboard/chat")({
  head: () => ({
    meta: [
      { title: "Desk chat — VIGIL" },
      {
        name: "description",
        content:
          "ChatGPT-style VIGIL Desk with memory, streaming answers, and hard daily caps.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <DashboardShell title="Desk chat" kicker="Memory · streaming · hard daily cap">
      <DeskChatApp />
    </DashboardShell>
  );
}
