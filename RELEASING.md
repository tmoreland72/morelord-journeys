# Releasing Morelord Journeys

Dispatch the **Release** workflow from the `main` branch after this workflow file is on `main`. The workflow runs `.github/workflows/release.yml` on `ubuntu-latest` with PowerShell. It does not run in-Foundry tests.

## Secrets

Add both secrets under **Settings > Secrets and variables > Actions** before the first dispatch:

| Secret | Used for |
| --- | --- |
| `RELEASE_PUBLISH_TOKEN` | `morelordgaming.com` release feed |
| `FOUNDRY_RELEASE_TOKEN` | Foundry VTT package listing |

The workflow passes those values only as environment variables on the publish step. It does not write a `.env` file and it does not print the values. The job stops with a clear error when either secret is empty.

`GITHUB_TOKEN` is provided by Actions. The workflow sets `GH_TOKEN` from it so `release.ps1` can commit, tag, push, and create the GitHub Release. The workflow grants `contents: write` and commits as `github-actions[bot]`. Branch protection on `main` must allow that bot to push commits and tags.

## Inputs

| Input | Default | Effect |
| --- | --- | --- |
| `bump` | `patch` | Used only when `version` is empty and `publish_only` is false |
| `version` | empty | Explicit `x.y.z`. When set, `bump` is ignored |
| `publish_only` | false | Skip the version bump, tag, and GitHub Release. Publish that version to the website and then to Foundry |

With `module.json` at `0.4.1` and no explicit version, the bumps are:

| `bump` | Next version |
| --- | --- |
| `patch` | `0.4.2` |
| `minor` | `0.5.0` |
| `major` | `1.0.0` |

`publish_only` without `version` uses the version already in `module.json`. It does not increment it. `publish_only` with `version` publishes that exact version. `module.json` on `main` must already equal that version, and the `v` tag must already exist on `origin`. The first use of this mode is `version` `0.4.1` and `publish_only` true, which sends the existing 0.4.1 release to the website feed and the Foundry listing.

A normal release still needs `release-notes/RELEASE-NOTES-<version>.md` and `docs/README.md` frontmatter for that version before the dispatch. `release.ps1` creates the commit, tag, GitHub Release, website record, and Foundry release.

## Changelog

Per-version release notes live in `release-notes/RELEASE-NOTES-<version>.md`. Those files are excluded from release archives. Every release maintains a cumulative root `CHANGELOG.md`: newest version first, `#`/`##`/`###` headings with a space after `#`, `- ` bullets, and no `---` horizontal rules. `release.ps1` rebuilds that file from `release-notes/RELEASE-NOTES-*.md` before it stages the archive, keeps the user-facing sections under `## What Changed`, and omits `## Verification` and other internal test sections. It then commits `CHANGELOG.md` with `module.json` (`git add -- module.json CHANGELOG.md`).

`release.config.json` lists `CHANGELOG.md` in `requiredPaths`, so the file is copied to the root of the release `.zip` and `Assert-Archive` checks that it is present. In-Foundry changelog viewers and GitHub users read that packaged file.

`-ValidateOnly` runs the same changelog rebuild and archive checks without committing, tagging, or publishing, and it does not require the release branch. When `CHANGELOG.md` is already up to date, the rebuild does not rewrite the file and leaves the Git worktree unchanged. `-DryRun` does not modify `CHANGELOG.md`; the generated text is still what the dry-run archive contains.

## Morelord Core and tests

When `publish_only` is false, the workflow checks out `tmorelord72/morelord-core` and moves it beside this repository so `npm test` can import Core. That checkout uses `GITHUB_TOKEN`.

`morelord-core` is not publicly cloneable. `GITHUB_TOKEN` from this repository can read **this** repository only. It cannot read another private repository. Until `morelord-core` is public, or the checkout token can read it, the Core checkout step fails and the full unit suite does not run. `publish_only` skips that checkout and skips `npm test`.

## Local equivalents

Website-only and Foundry-only publishing are separate script invocations. They do not commit, tag, or create a GitHub Release.

```powershell
$env:RELEASE_PUBLISH_TOKEN = '<token>'
./release.ps1 -Version 0.4.1 -WebsiteOnly
$env:FOUNDRY_RELEASE_TOKEN = '<token>'
./release.ps1 -Version 0.4.1 -FoundryOnly
```
