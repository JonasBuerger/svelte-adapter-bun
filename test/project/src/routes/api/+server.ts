import { text } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ request }) => {
  return text("get route: " + request.url.toString());
};
export const POST: RequestHandler = ({ request }) => {
  return text("post route: " + request.url.toString());
};
