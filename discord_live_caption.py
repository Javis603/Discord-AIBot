import sounddevice as sd
from scipy.io.wavfile import write
import numpy as np

# Configuration
samplerate = 16000  # Hertz
duration = 5      # Seconds
filename = 'output.wav'

print("Recording audio for 5 seconds...")
myrecording = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='int16')
sd.wait()  # Wait until recording is finished
print("Recording finished. Saving to output.wav...")
write(filename, samplerate, myrecording)  # Save as WAV file

print(f"Audio saved to {filename}. Playing back the recorded audio...")
sd.play(myrecording, samplerate)
sd.wait()  # Wait until playback is finished
print("Playback finished.")
