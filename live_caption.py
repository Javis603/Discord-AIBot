
import argparse
import os
import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write, read
import whisper
from openai import OpenAI
from dotenv import load_dotenv

def list_audio_devices():
    """Lists available audio devices."""
    print("Available audio devices:")
    print(sd.query_devices())

def record_audio(device_index, samplerate=16000, duration=5):
    """Records audio from a specified device."""
    filename = "temp_recording.wav"
    print(f"\nRecording for {duration} seconds from device {device_index}...")
    recording = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, device=device_index, dtype='int16')
    sd.wait()
    write(filename, samplerate, recording)
    print(f"Recording saved to {filename}")
    return filename

def transcribe_audio(model, audio_path):
    """Transcribes audio using the Whisper model."""
    print("Transcribing audio...")
    result = model.transcribe(audio_path)
    print("Transcription complete.")
    return result['text']

def get_openai_response(client, text):
    """Gets a conversational response from OpenAI."""
    print("Getting response from OpenAI...")
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant, responding in a conversational manner."},
            {"role": "user", "content": text}
        ]
    )
    print("Response received.")
    return response.choices[0].message.content

def text_to_speech(client, text, output_filename="response.wav"):
    """Converts text to speech using OpenAI's TTS."""
    print("Generating speech...")
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    response.stream_to_file(output_filename)
    print(f"Speech saved to {output_filename}")
    return output_filename

def play_audio(audio_path, device_index):
    """Plays an audio file to a specified device."""
    samplerate, data = read(audio_path)
    print(f"Playing audio to device {device_index}...")
    sd.play(data, samplerate, device=device_index)
    sd.wait()
    print("Playback finished.")

def main():
    parser = argparse.ArgumentParser(description="Live caption and TTS for Discord.")
    parser.add_argument('--dotenv_path', type=str, help="Path to your .env file.")
    args = parser.parse_args()

    if args.dotenv_path:
        load_dotenv(dotenv_path=args.dotenv_path)
    else:
        load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not found. Please create a .env file with your API key or provide the path using --dotenv_path.")
        return

    client = OpenAI(api_key=api_key)

    list_audio_devices()

    try:
        input_device = int(input("\nEnter the index of your microphone (input device): "))
        output_device = int(input("Enter the index of your virtual audio cable (output device, e.g., CABLE Input): "))
    except ValueError:
        print("Invalid device index. Please enter a number.")
        return

    print("\nLoading Whisper model...")
    model = whisper.load_model("base")
    print("Whisper model loaded.")

    while True:
        input("Press Enter to start recording, or Ctrl+C to exit.")
        
        # 1. Record audio
        recorded_file = record_audio(input_device)
        
        # 2. Transcribe audio
        transcribed_text = transcribe_audio(model, recorded_file)
        print(f"Transcription: {transcribed_text}")
        
        # 3. Get OpenAI response
        openai_response = get_openai_response(client, transcribed_text)
        print(f"OpenAI Response: {openai_response}")
        
        # 4. Convert response to speech
        speech_file = text_to_speech(client, openai_response)
        
        # 5. Play speech to virtual audio cable
        play_audio(speech_file, output_device)

if __name__ == "__main__":
    main()
