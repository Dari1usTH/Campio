import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL: the campaign page now renders generation progress itself. */
export const Route = createFileRoute("/app/generating/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/campaigns/$id",
      params: { id: params.id },
      replace: true,
    });
  },
});
