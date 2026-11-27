param([Parameter(Mandatory)][string]$BaseUrl,[Parameter(Mandatory)][int]$ServerPid,
      [Parameter(Mandatory)][string]$OutputFile,[int]$Seconds=10)
$ErrorActionPreference='Stop'
$cores=[Environment]::ProcessorCount
$previous=(Invoke-RestMethod "$BaseUrl/api/v1/tempo").escala
$rows=@()
try {
  foreach($speed in 1,5,10,50){
    Invoke-RestMethod "$BaseUrl/api/v1/tempo" -Method Post -ContentType application/json -Body (@{escala=$speed}|ConvertTo-Json) | Out-Null
    Start-Sleep -Seconds 2
    $procBefore=Get-Process -Id $ServerPid
    $cpuBefore=$procBefore.TotalProcessorTime.TotalSeconds
    $threads=@{}
    foreach($thread in $procBefore.Threads){$threads[$thread.Id]=$thread.TotalProcessorTime.TotalSeconds}
    $clock=[Diagnostics.Stopwatch]::StartNew()
    Start-Sleep -Seconds $Seconds
    $procAfter=Get-Process -Id $ServerPid
    $wall=$clock.Elapsed.TotalSeconds
    $pct=100*($procAfter.TotalProcessorTime.TotalSeconds-$cpuBefore)/$wall
    $sv=(Invoke-RestMethod "$BaseUrl/api/v1/snapshot").server
    $breakdown=foreach($thread in $procAfter.Threads){
      if($threads.ContainsKey($thread.Id)){
        @{tid=$thread.Id;cpuPctCore=100*($thread.TotalProcessorTime.TotalSeconds-$threads[$thread.Id])/$wall}
      }
    }
    $rows+=@{requested=$speed;effective=$sv.escala_efetiva;seconds=$wall;cpuPctCore=$pct;cpuPctMachine=$pct/$cores;logical=$cores;rssBytes=$procAfter.WorkingSet64;threads=$breakdown;lastInterval=$sv.intervalo_ms;backlog=$sv.divida_passos;dropped=$sv.passos_descartados}
    $rows|ConvertTo-Json -Depth 6|Set-Content -Encoding utf8 $OutputFile
  }
} finally {
  Invoke-RestMethod "$BaseUrl/api/v1/tempo" -Method Post -ContentType application/json -Body (@{escala=$previous}|ConvertTo-Json)|Out-Null
}
