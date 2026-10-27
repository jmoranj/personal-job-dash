# personal-job-dash

Black-and-white dashboard for [personal-job-api](https://github.com/jmoranj/personal-job-api). It lists remote software and AI jobs you can take from Brazil, ranked by match. You can move each job through New, Saved, Applied, Interviewing, Offer, Rejected or Dismissed, and keep notes on it.

Built with React, Vite, Tailwind and shadcn/ui.

## Run

Start the API first (see its README). Then:

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` serves on http://localhost:5173 and proxies `/api` to the backend on port 8787.

To serve the dashboard from the API itself at http://localhost:8787 instead, run `pnpm build`. The API serves `dist/` when the two repos sit side by side.
