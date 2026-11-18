import { Suspense } from "react";

import { GuestSubmissionPage } from "@/features/guest-submission/pages/GuestSubmissionPage";

async function GuestSubmissionRoute({ params }: Pick<PageProps<"/v/[venueSlug]">, "params">) {
  const { venueSlug } = await params;
  return <GuestSubmissionPage venueSlug={venueSlug} />;
}

export default function Page({ params }: PageProps<"/v/[venueSlug]">) {
  return (
    <Suspense>
      <GuestSubmissionRoute params={params} />
    </Suspense>
  );
}
