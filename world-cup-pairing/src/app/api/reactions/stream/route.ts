import { addClient, removeClient } from "@/lib/reaction-stream";

export const dynamic = "force-dynamic";

export async function GET() {
  let write: (data: string) => void;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      write = (data: string) => {
        if (!closed) {
          try { controller.enqueue(new TextEncoder().encode(data)); }
          catch { closed = true; removeClient(write); }
        }
      };
      addClient(write);
      // Send a heartbeat immediately so the connection doesn't time out
      write(`: heartbeat\n\n`);
    },
    cancel() {
      closed = true;
      removeClient(write);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
