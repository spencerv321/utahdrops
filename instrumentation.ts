export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A stray rejected promise (e.g. a database "statement timeout") used to
  // crash the whole server process, and every other visitor on that instance
  // then hung until Vercel's 300s limit. Log it instead of exiting.
  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection (kept running):", reason);
  });
}
