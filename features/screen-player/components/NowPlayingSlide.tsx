import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import { InstagramIcon, LineIcon } from "@/features/screen-player/components/SocialIcons";
import type { Submission } from "@/interfaces/submission/submission";

// Instagram / LINE rows: the platform logo, then the handle.
const CONTACT_LINE = "flex items-center gap-[0.35em] text-[3vw] font-extrabold";

interface NowPlayingSlideProps {
  submission: Submission;
  progress: number;
}

export function NowPlayingSlide({ submission, progress }: NowPlayingSlideProps) {
  const hasPhoto = Boolean(submission.photoPath);

  return (
    // Top/bottom padding clears the event header; the text column starts below the top-right QR corner.
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
        className={`flex min-w-0 flex-1 flex-col justify-center gap-[2vh] self-stretch pt-[27vh] text-white drop-shadow-lg ${hasPhoto ? "" : "items-center text-center"}`}
      >
        <p className="text-[5vw] leading-tight font-extrabold break-words">{submission.message}</p>
        {submission.instagram ? (
          <p className={`${CONTACT_LINE} text-event-blush`}>
            <InstagramIcon />
            <span className="min-w-0 break-words">@{submission.instagram}</span>
          </p>
        ) : null}
        {submission.lineId ? (
          <p className={`${CONTACT_LINE} text-event-sage`}>
            <LineIcon />
            <span className="min-w-0 break-words">{submission.lineId}</span>
          </p>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[1.2vh] bg-white/20" aria-hidden>
        <div className="h-full bg-event-rose transition-[width] duration-500 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
