import type { RealtimeChannel } from "@supabase/supabase-js";

import type { RealtimeConnectionStatus, SignalAudience, VenueSignal } from "@/interfaces/realtime/venue-signal";
import type { SubmissionStatus } from "@/interfaces/submission/submission";
import { SUBMISSION_STATUSES } from "@/lib/mappers/submission.mapper";
import { getBrowserSupabase } from "@/lib/services/supabase-browser";
import { asRecord, readEnum, readNullableString, readString } from "@/lib/utils/read-field";

// One shared Supabase Realtime channel per venue topic, ref-counted across listeners,
// so several hooks on one page don't open duplicate sockets/channels.

type SignalListener = (signal: VenueSignal) => void;
type StatusListener = (status: RealtimeConnectionStatus) => void;

interface TopicEntry {
  channel: RealtimeChannel;
  signalListeners: Set<SignalListener>;
  statusListeners: Set<StatusListener>;
  status: RealtimeConnectionStatus;
}

const topics = new Map<string, TopicEntry>();

function topicForVenue(venueId: string, audience: SignalAudience): string {
  return `venue:${venueId}:${audience}`;
}

function mapSubmissionChanged(payload: unknown): VenueSignal {
  const record = asRecord(payload);
  return {
    type: "submission_changed",
    submissionId: readString(record, "submissionId"),
    status: readEnum<SubmissionStatus>(record, "status", SUBMISSION_STATUSES, "pending_approval"),
  };
}

function mapScreenStateChanged(payload: unknown): VenueSignal {
  const record = asRecord(payload);
  return {
    type: "screen_state_changed",
    currentSubmissionId: readNullableString(record, "currentSubmissionId"),
    endsAt: readNullableString(record, "endsAt"),
  };
}

function emit(entry: TopicEntry, signal: VenueSignal): void {
  for (const listener of entry.signalListeners) {
    listener(signal);
  }
}

function setStatus(entry: TopicEntry, status: RealtimeConnectionStatus): void {
  entry.status = status;
  for (const listener of entry.statusListeners) {
    listener(status);
  }
}

function openTopic(topic: string): TopicEntry {
  const channel = getBrowserSupabase().channel(topic);
  const entry: TopicEntry = {
    channel,
    signalListeners: new Set(),
    statusListeners: new Set(),
    status: "connecting",
  };

  channel
    .on("broadcast", { event: "submission_changed" }, (message) => emit(entry, mapSubmissionChanged(message.payload)))
    .on("broadcast", { event: "screen_state_changed" }, (message) => emit(entry, mapScreenStateChanged(message.payload)))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStatus(entry, "connected");
        // Catch up on anything missed while disconnected.
        emit(entry, { type: "connected" });
        return;
      }
      setStatus(entry, status === "CLOSED" ? "disconnected" : "connecting");
    });

  return entry;
}

export interface VenueSubscription {
  onSignal: SignalListener;
  onStatus?: StatusListener;
}

/** Subscribes to a venue's signals. Returns an unsubscribe function. */
export function subscribeToVenueSignals(
  venueId: string,
  audience: SignalAudience,
  subscription: VenueSubscription,
): () => void {
  const topic = topicForVenue(venueId, audience);
  const entry = topics.get(topic) ?? openTopic(topic);
  topics.set(topic, entry);

  entry.signalListeners.add(subscription.onSignal);
  if (subscription.onStatus) {
    entry.statusListeners.add(subscription.onStatus);
    subscription.onStatus(entry.status);
  }

  return () => {
    entry.signalListeners.delete(subscription.onSignal);
    if (subscription.onStatus) {
      entry.statusListeners.delete(subscription.onStatus);
    }
    if (entry.signalListeners.size === 0) {
      topics.delete(topic);
      void getBrowserSupabase().removeChannel(entry.channel);
    }
  };
}
