import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import { InstagramIcon, LineIcon } from "@/features/screen-player/components/SocialIcons";
import type { Submission } from "@/interfaces/submission/submission";

// Instagram / LINE rows: the platform logo, then the handle.
const CONTACT_LINE = "flex items-center gap-[0.35em] text-[3vw] font-extrabold";
// Where the text column sits so it never runs under the top-right QR corner (about the top 36vh of the right 20vw):
// - next to a photo, the column is on the right, so it starts below the QR;
// - with no photo, it's centred on the screen: side padding keeps it out of the QR's column, and the bottom
//   padding matches the slide's top padding so the block's centre is the screen's centre.
const TEXT_WITH_PHOTO = "pt-[27vh]";
const TEXT_ONLY = "items-center px-[17vw] pb-[5vh] text-center";

interface NowPlayingSlideProps {
  submission: Submission;
  progress: number;
}

export function NowPlayingSlide({ submission, progress }: NowPlayingSlideProps) {
  const hasPhoto = Boolean(submission.photoPath);

  return (
    // Top/bottom padding clears the event header and the progress bar.
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
        className={`flex min-w-0 flex-1 flex-col justify-center gap-[2vh] self-stretch text-white drop-shadow-lg ${hasPhoto ? TEXT_WITH_PHOTO : TEXT_ONLY}`}
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
