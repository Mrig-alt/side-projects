interface PresenceDotProps {
  lastSeenAt: Date | null;
}

export default function PresenceDot({ lastSeenAt }: PresenceDotProps) {
  if (!lastSeenAt) return null;
  const isOnline = Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
  if (!isOnline) return null;

  return (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" title="Online now" />
  );
}
