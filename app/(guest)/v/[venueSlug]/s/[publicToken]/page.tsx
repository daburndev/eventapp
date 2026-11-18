import { Suspense } from "react";

import { SubmissionStatusPage } from "@/features/guest-submission/pages/SubmissionStatusPage";

async function SubmissionStatusRoute({ params }: Pick<PageProps<"/v/[venueSlug]/s/[publicToken]">, "params">) {
  const { venueSlug, publicToken } = await params;
  return <SubmissionStatusPage venueSlug={venueSlug} publicToken={publicToken} />;
}

export default function Page({ params }: PageProps<"/v/[venueSlug]/s/[publicToken]">) {
  return (
    <Suspense>
      <SubmissionStatusRoute params={params} />
    </Suspense>
  );
}
