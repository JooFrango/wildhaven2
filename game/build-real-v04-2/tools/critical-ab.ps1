param([string]$Executable,[string]$OutputFile,[int]$Seconds=90,[int]$Scale=1)
$ErrorActionPreference='Stop'
$env:WH_BIND='127.0.0.1:18921'
$env:WH_TIME_SCALE="$Scale"
$env:WH_PACOTES_URL='http://127.0.0.1:18921/offline/'
$env:WH_CACHE_MB='128'
$env:WH_CLOCK_EPOCH_MS='1735689600000'
$env:DATABASE_URL=''
$url='http://127.0.0.1:18921'
if (Get-NetTCPConnection -LocalPort 18921 -State Listen -ErrorAction SilentlyContinue){throw 'Porta de teste ocupada'}
$timer=[Diagnostics.Stopwatch]::StartNew()
$p=Start-Process -FilePath $Executable -WorkingDirectory $env:WH_REPO_ROOT -WindowStyle Hidden -PassThru
$samples=@()
try {
  for($i=0;$i -lt 60;$i++){
    if($p.HasExited){throw 'Servidor encerrou'}
    try {if((Invoke-RestMethod "$url/api/v1/health") -eq 'ok'){break}}catch{}
    Start-Sleep -Milliseconds 250
  }
  if((Invoke-RestMethod "$url/") -notmatch 'Wildhaven'){throw 'HTML do jogo ausente'}
  while($timer.Elapsed.TotalSeconds -lt $Seconds){
    $s=Invoke-RestMethod "$url/api/v1/snapshot"
    if($s.server){
      $samples+=@{seconds=$timer.Elapsed.TotalSeconds;tick=$s.tick;creatures=$s.game.metrics.creatures_total;
        hunters=$s.hunters.Count;events=@($s.game.events | ForEach-Object { @($_.seq,$_.kind) -join ':' });
        timing=$s.server.intervalo_ms;terrain=$s.server.terreno;process=$s.server.processo}
    }
    Start-Sleep -Seconds 1
  }
  $picos=$null
  try {$picos=Invoke-RestMethod "$url/api/v1/diagnostico/picos"}catch{}
  if(!$samples.Count -or $samples[-1].hunters -lt 6){throw 'Sem snapshot funcional'}
  @{duration=$timer.Elapsed.TotalSeconds;scale=$Scale;samples=$samples;incidents=$picos}|ConvertTo-Json -Depth 9|Set-Content -Encoding utf8 $OutputFile
} finally {if(!$p.HasExited){Stop-Process -InputObject $p;$p.WaitForExit()}}
