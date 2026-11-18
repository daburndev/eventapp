import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import type { Submission } from "@/interfaces/submission/submission";

interface NowPlayingSlideProps {
  submission: Submission;
  progress: number;
}

export function NowPlayingSlide({ submission, progress }: NowPlayingSlideProps) {
  const hasPhoto = Boolean(submission.photoPath);

  return (
    // Top/bottom padding clears the event header; the text column stops above the QR corner.
    <div className="relative flex h-full w-full items-center gap-[4vw] px-[4vw] pt-[11vh] pb-[6vh]">
      {hasPhoto ? (
        <SubmissionPhoto
          variant="screen"
          photoPath={submission.photoPath}
          alt={submission.message}
          className="h-full max-h-[83vh] w-auto max-w-[50vw] rounded-[2vw] shadow-2xl"
        />
      ) : null}
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center gap-[2vh] self-stretch pb-[30vh] text-white drop-shadow-lg ${hasPhoto ? "" : "items-center text-center"}`}
      >
        <p className="text-[5vw] leading-tight font-extrabold break-words">{submission.message}</p>
        {submission.instagram ? <p className="text-[3vw] font-extrabold text-event-blush">@{submission.instagram}</p> : null}
        {submission.lineId ? (
          <p className="text-[3vw] font-extrabold text-event-sage">
            <span className="text-[0.7em] tracking-wider">LINE</span> {submission.lineId}
          </p>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[1.2vh] bg-white/20" aria-hidden>
        <div className="h-full bg-event-rose transition-[width] duration-500 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
