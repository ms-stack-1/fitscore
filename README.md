# FitScore

Evidence-based matching of job descriptions to CVs, and ranking of applicants against criteria a recruiter sets.

- **Engines judge, code scores.** Every engine (a rule engine in the browser, a free AI tier, or Claude with your own key) returns per-criterion judgments that must cite verbatim CV lines. One pure function turns judgments into scores, so numbers are comparable and every point is traceable.
- **Blind by default.** Names, contact details, birth dates, graduation years and other proxies are removed before any engine sees a CV.
- **Local-first.** Roles, CVs and results stay in your browser. Nothing is stored on a server.
- **Decision support, not decision.** FitScore ranks evidence; a person decides. Unmet knockouts are flagged for review, never auto-rejected.

> Status: in development.

## Develop

```sh
npm install
npm test        # vitest
npm run typecheck
npm run dev
```

## License

MIT
