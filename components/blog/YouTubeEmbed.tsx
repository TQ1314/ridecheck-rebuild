interface YouTubeEmbedProps {
  videoId: string;
  caption?: string;
}

export function YouTubeEmbed({ videoId, caption }: YouTubeEmbedProps) {
  return (
    <figure className="my-6">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-sm" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={caption || "RideCheck video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-gray-500 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
