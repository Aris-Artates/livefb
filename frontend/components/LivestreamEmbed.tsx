import { useEffect } from "react";

interface LivestreamEmbedProps {
  facebookVideoId?: string;
  facebookGroupId?: string;
  title?: string;
}

/**
 * Embeds a Facebook video/live-stream using the Facebook JS SDK (XFBML).
 *
 * Security note: For videos in PRIVATE Facebook groups, the viewer must:
 *   1. Be logged into Facebook in the same browser.
 *   2. Be a member of that group.
 *   3. The app must have the `groups_access_member_info` permission approved.
 *
 * The embed itself doesn't bypass Facebook's privacy — it renders exactly
 * what the logged-in Facebook user is allowed to see.
 */
export default function LivestreamEmbed({
  facebookVideoId,
  facebookGroupId,
  title = "Facebook Live Stream",
}: LivestreamEmbedProps) {
  useEffect(() => {
    // Re-parse XFBML widgets after the component mounts / updates
    if (typeof window !== "undefined" && window.FB?.XFBML) {
      window.FB.XFBML.parse();
    }
  }, [facebookVideoId]);

  if (!facebookVideoId) {
    return (
      <div className="bg-gray-800 aspect-video rounded-xl flex items-center justify-center">
        <p className="text-gray-500 text-sm">Stream not available</p>
      </div>
    );
  }

  const videoUrl = facebookGroupId
    ? `https://www.facebook.com/groups/${facebookGroupId}/permalink/${facebookVideoId}`
    : `https://www.facebook.com/video.php?v=${facebookVideoId}`;

  return (
    <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
      {/*
        fb-video XFBML tag:
        The Facebook JS SDK replaces this div with the video player.
        The viewer must be authenticated to Facebook to see private group videos.
      */}
      <div
        className="fb-video"
        data-href={videoUrl}
        data-width="auto"
        data-autoplay="false"
        data-allowfullscreen="true"
        data-show-text="false"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
