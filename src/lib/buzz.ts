// The game timer's buzz when the set length is up: a vibration (most Android
// phones) and two short beeps. Browsers only allow sound after a tap, so the
// pitch-side buttons call unlockSound() when an admin touches them.
let audio: AudioContext | null = null

export function unlockSound() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    audio = null
  }
}

export function buzz() {
  navigator.vibrate?.([300, 150, 300])
  if (!audio) return
  for (const at of [0, 0.4]) {
    const tone = audio.createOscillator()
    const volume = audio.createGain()
    tone.frequency.value = 880
    volume.gain.value = 0.2
    tone.connect(volume).connect(audio.destination)
    tone.start(audio.currentTime + at)
    tone.stop(audio.currentTime + at + 0.25)
  }
}
