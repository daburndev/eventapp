import { EVENT_BRAND } from "@/lib/constants/event-brand";

// Placeholder: have the final PDPA privacy notice reviewed before launch.
export function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{EVENT_BRAND.name}</p>
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p className="text-muted">
        When you send a message to a venue screen we receive your photo, message, and Instagram handle and LINE ID (if you add them).
        We use them only to show your message on that screen.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-muted">
        <li>
          Your photo, message, Instagram handle and LINE ID are deleted right after your time on the screen ends, including
          the photo file in storage.
        </li>
        <li>Anything still waiting in the queue when the event ends is deleted then, and so is anything not approved.</li>
        <li>We keep only anonymous counts (for example, how many messages were sent) for the organiser&apos;s reports.</li>
      </ul>
      <p className="text-sm text-muted">Full notice and contact details: coming soon.</p>
    </main>
  );
}
