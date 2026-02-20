import soundfile as sf
import librosa
import joblib
import numpy as np

def extract_1d_mfcc(audio_array, sampling_rate):
    # Compute MFCCs (Returns 2D array: 50 x Time frames)
    mfccs = librosa.feature.mfcc(y=audio_array, sr=sampling_rate, n_mfcc=50, hop_length=512)

    # Average across the time axis (axis=1) to flatten it
    # This turns the 2D array into a 1D array of exactly 50 numbers.
    mfccs_mean = np.mean(mfccs, axis=1)

    return mfccs_mean
def ClassifyDroneSignal(audioPath, classifierPath):
  clf = joblib.load(classifierPath)
  audio, sample_rate = sf.read(audioPath)
  features = extract_1d_mfcc(audio, sample_rate).reshape(1, -1)
  return float(clf.predict(features)[0])