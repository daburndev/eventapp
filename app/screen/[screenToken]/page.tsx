import { Suspense } from "react";

import { ScreenPlayerPage } from "@/features/screen-player/pages/ScreenPlayerPage";

async function ScreenRoute({ params }: Pick<PageProps<"/screen/[screenToken]">, "params">) {
  const { screenToken } = await params;
  return <ScreenPlayerPage screenToken={screenToken} />;
}

export default function Page({ params }: PageProps<"/screen/[screenToken]">) {
  return (
    <Suspense>
      <ScreenRoute params={params} />
    </Suspense>
  );
}
