# Portfolio Website

Mrigank Shekhar's personal portfolio — projects, skills, currently-learning notes, certifications, and blog. Built with Next.js (App Router), TypeScript, Tailwind CSS 4, Framer Motion, and MDX.

This branch is an orphan branch (no shared history with `main`), kept separate since it's an unrelated site rather than one of the other side projects in this repo.

## Structure

- `src/lib/data.ts` — all content: profile/about, projects, skills, currently-learning list, certifications, blog post metadata. Edit this to update most of the site.
- `src/app/page.tsx` — homepage (hero, about, projects, skills, writing preview)
- `src/app/certifications/page.tsx` — certifications (empty state until entries are added to `certifications` in `data.ts`)
- `src/app/learning/page.tsx` — currently-learning + toolkit
- `src/app/blog/page.tsx` — blog index
- `src/app/blog/<slug>/page.mdx` — individual posts, one folder per post. Currently stubbed with a one-line premise per the original topic list — edit the `.mdx` file directly to write the full post.
- `src/components/` — `Nav`, `Footer`, `Hero` (parallax), `ProjectList`, `SkillsGrid`, `PostLayout`, `SectionHeading`

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding content

- **New project**: add an entry to the `projects` array in `src/lib/data.ts`.
- **New certification**: add an entry to the `certifications` array in `src/lib/data.ts`.
- **New blog post**: create `src/app/blog/<slug>/page.mdx` (copy an existing one as a template) and add a matching entry to `blogPosts` in `src/lib/data.ts` so it shows up in the index.

## Deploy

Static-exportable Next.js app — deploys as-is to Vercel or Netlify, or via `next build && next export`-style static hosting (e.g. GitHub Pages) with minimal config changes.
