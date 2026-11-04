const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { rename, rm } = require("node:fs/promises");
const { join, resolve } = require("node:path");

const speechGuidance = "Windows Speech couldn't record the narration. Check that a desktop speech voice is installed, then try again.";
const toolEnvNames = /^(?:PATH|PATHEXT|SystemRoot|SystemDrive|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|ProgramData|ProgramFiles(?:\(x86\))?|LANG|LC_ALL|LD_LIBRARY_PATH|DYLD_LIBRARY_PATH)$/i;

function renderToolEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => toolEnvNames.test(name)));
}

const speechScript = Buffer.from(`
  $ErrorActionPreference = 'Stop'
  try {
    Add-Type -AssemblyName System.Speech
    $speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd()))
    if ($env:STUDYGRAM_NARRATION_VOICE) {
      $speech.SelectVoice($env:STUDYGRAM_NARRATION_VOICE)
    } else {
      $voices = @($speech.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Gender -eq 'Female' -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en' })
      $preferred = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq 'en-IN' } | Select-Object -First 1
      if (-not $preferred) { $preferred = $voices | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Zira Desktop' } | Select-Object -First 1 }
      if (-not $preferred) { $preferred = $voices | Select-Object -First 1 }
      if (-not $preferred) { throw 'Install a feminine English Windows desktop speech voice to record narration.' }
      $speech.SelectVoice($preferred.VoiceInfo.Name)
    }
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, 'Sixteen', 'Mono')
    $speech.SetOutputToWaveFile($env:STUDYGRAM_NARRATION_WAV, $format)
    $speech.Speak($text)
    [Console]::WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($speech.Voice.Name)))
    } finally {
      $speech.Dispose()
    }
  } catch {
    # Exception messages can include paths or input. Emit only diagnostic fields.
    $cause = $_.Exception.GetBaseException()
    [Console]::Error.WriteLine(('STUDYGRAM_SPEECH {0} {1} {2}' -f $cause.GetType().FullName, $cause.HResult, $_.InvocationInfo.ScriptLineNumber))
    exit 1
  }
`, "utf16le").toString("base64");

function speakOnWindows(text, path, voice, signal) {
  const powershell = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolveVoice, reject) => {
    const child = spawn(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", speechScript], {
      env: { ...renderToolEnvironment(), STUDYGRAM_NARRATION_WAV: path, STUDYGRAM_NARRATION_VOICE: voice },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      signal,
    });
    let error;
    let output = "";
    let stderr = "";
    child.on("error", cause => { error = cause; });
    child.stdin.on("error", cause => { error ||= cause; });
    child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr = (stderr + chunk).slice(-4096); });
    child.on("close", (code, exitSignal) => {
      if (signal?.aborted) return reject(signal.reason);
      if (error || code !== 0 || !output.trim()) {
        const exception = /(?:^|\n)STUDYGRAM_SPEECH ([\w.]{1,150}) (-?\d{1,10}) (\d{1,5})(?:\r?\n|$)/.exec(stderr);
        return reject(Object.assign(new Error(speechGuidance, { cause: error }), {
          step: "speech-synthesis",
          publicMessage: speechGuidance,
          diagnostic: {
            tool: "Windows Speech", exitCode: code, exitSignal,
            ...(exception && { exception: exception[1], hresult: Number(exception[2]), scriptLine: Number(exception[3]) }),
          },
        }));
      }
      resolveVoice(Buffer.from(output.trim(), "base64").toString("utf8"));
    });
    child.stdin.end(Buffer.from(text, "utf8").toString("base64"));
  });
}

async function synthesizeNarration({ text, outputPath, signal, engine }) {
  signal?.throwIfAborted();
  if (process.platform !== "win32") throw new Error("Local narration requires Windows Speech on this installation.");
  const requestedVoice = engine?.match(/^Windows Speech \((.+)\)$/)?.[1];
  if (engine && !requestedVoice) throw new Error("The reel's selected voice engine is unavailable.");
  const destination = resolve(outputPath);
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;
  let completed = false;
  try {
    const voice = await speakOnWindows(text, temporaryPath, requestedVoice || "", signal);
    signal?.throwIfAborted();
    try {
      await rename(temporaryPath, destination);
    } catch (cause) {
      signal?.throwIfAborted();
      throw Object.assign(new Error("Could not publish the narration WAV.", { cause }), { step: "wav-publication" });
    }
    completed = true;
    return { engine: `Windows Speech (${voice})` };
  } finally {
    if (!completed) await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

module.exports = { synthesizeNarration, renderToolEnvironment };
