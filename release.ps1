# Morelord release launcher. Module-specific values belong in release.config.json;
# shared release behavior comes from the canonical runner, not the Foundry module.
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfiguredRunner = $env:MORELORD_RELEASE_RUNNER
$SiblingRunner = Join-Path (Split-Path -Parent $ProjectRoot) 'morelord-core\release.ps1'
$Runner = if (-not [string]::IsNullOrWhiteSpace($ConfiguredRunner)) { $ConfiguredRunner } elseif (Test-Path $SiblingRunner) { $SiblingRunner } else { $null }
if (-not $Runner -or -not (Test-Path $Runner -PathType Leaf)) {
    throw 'The standard Morelord release runner was not found. Set MORELORD_RELEASE_RUNNER to its release.ps1 path.'
}

$LocalRunner = Join-Path $ProjectRoot ('.release-runner-' + [guid]::NewGuid().ToString('N') + '.ps1')
try {
    Copy-Item -LiteralPath $Runner -Destination $LocalRunner
    & $LocalRunner @args
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Remove-Item -LiteralPath $LocalRunner -Force -ErrorAction SilentlyContinue
}
