# Contribution graph automation

`build-contributions.mjs` reads your contribution calendar from the GitHub GraphQL API and
redraws `assets/contributions.svg` in the portfolio palette. The workflow in
`.github/workflows/contributions.yml` runs it daily and on demand.

## One-time setup

1. **Show private activity.** On your profile, click *Contribution settings* above the calendar
   and turn on *Private contributions*. Without this, private work is not counted anywhere.
2. **Create a token.** GitHub, Settings, Developer settings, Personal access tokens. A classic
   token with only the `read:user` scope is enough to start with.
3. **Store it as a secret.** In the `pandistic-zain/pandistic-zain` repo: Settings, Secrets and
   variables, Actions, New repository secret. Name it exactly `PROFILE_TOKEN`.
4. **Run it once.** Actions tab, *contributions*, *Run workflow*. Open the run log and compare
   the two numbers it prints with your profile page. If they disagree, widen the token scope
   (add `repo`) and run again.

Until the first run, `contributions.svg` shows an "awaiting first sync" placeholder.

## What the graph shows

Dates and daily counts only. No repository, organisation or commit text is read into the file.
The workflow commits as `github-actions[bot]`, so its commits never add to your own graph.

## If counts look low

- Commits count only when the author email is added to your GitHub account and the commit is
  on the default branch.
- Private contributions appear as anonymous counts only while *Private contributions* is on.

## If the graph stops updating

GitHub pauses scheduled workflows in public repositories after a long period without repository
activity. Open the Actions tab and re-enable the workflow.

## Safety behaviour

The script keeps the previous graph and exits with an error if the token is missing, the API
call fails, or the new total is 0 while the previous graph was not. Error output redacts the
token. Local testing: `--sample` writes synthetic data (clearly bannered), `--empty` writes the
placeholder.
