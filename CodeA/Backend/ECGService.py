import os, warnings, copy
import numpy as np
import pandas as pd
import scipy.io
import matplotlib.pyplot as plt
from tqdm import tqdm
import xgboost as xgb 
from scipy.stats import skew, kurtosis
warnings.filterwarnings('ignore')
import joblib

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision
from transformers import AutoModel

from sklearn.metrics import (
    classification_report, roc_auc_score,
    roc_curve, auc, confusion_matrix, f1_score
)
def load_ecg(path):
    mat = scipy.io.loadmat(path)
    if 'val' in mat:
        ecg = mat['val']
    elif 'ECG' in mat:
        ecg = mat['ECG']['data'][0][0]
    else:
        for k, v in mat.items():
            if not k.startswith('_'):
                ecg = v
                break
    return ecg.astype(np.float32)

LEAD_NAMES = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']
SAMPLING_RATE    = 500
FIXED_LENGTH     = 4096
NUM_LEADS        = 12
HUBERT_INPUT_LEN = 500

CLASS_NAMES = [
    'Normal Sinus Rhythm',
    'Atrial Fibrillation (AF)',
    'First-degree AV Block (I-AVB)',
    'Left Bundle Branch Block (LBBB)',
    'Right Bundle Branch Block (RBBB)',
    'Premature Atrial Contraction (PAC)',
    'Premature Ventricular Contraction (PVC)',
    'ST-Segment Depression (STD)',
    'ST-Segment Elevation (STE)',
]
NUM_CLASSES = 9

def load_ecg(path):
    mat = scipy.io.loadmat(path)
    if 'val' in mat:
        ecg = mat['val']
    elif 'ECG' in mat:
        ecg = mat['ECG']['data'][0][0]
    else:
        for k, v in mat.items():
            if not k.startswith('_'):
                ecg = v
                break
    return ecg.astype(np.float32)

def preprocess_ecg(ecg, target_len=HUBERT_INPUT_LEN):
    """Normalize per lead and resample to 500 samples (100Hz x 5s) for HuBERT-ECG."""
    if ecg.ndim == 1:
        ecg = ecg[np.newaxis, :]
    ecg = ecg[:NUM_LEADS, :]
    # Z-score normalize per lead
    mu  = ecg.mean(axis=1, keepdims=True)
    sig = ecg.std(axis=1,  keepdims=True) + 1e-8
    ecg = ((ecg - mu) / sig).astype(np.float32)
    # Resample to target_len via linear interpolation
    ecg_t = torch.FloatTensor(ecg).unsqueeze(0)           # (1, 12, N)
    ecg_t = F.interpolate(ecg_t, size=target_len, mode='linear', align_corners=False)
    return ecg_t.squeeze(0).numpy()           


class HuBERTECGClassifier(nn.Module):
    def __init__(self, backbone, hidden_size, num_classes):
        super().__init__()
        self.backbone   = backbone
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )

    def forward(self, x):
        # x: (batch, 12, 500)
        # HuBERT expects (batch, time) — flatten 12 leads into one sequence
        batch = x.shape[0]
        x = x.reshape(batch, -1)          # (batch, 12*500 = 6000)
        outputs = self.backbone(x)
        pooled  = outputs.last_hidden_state.mean(dim=1)   # (batch, hidden_size)
        return self.classifier(pooled)


def PredictECGSignal(ecgSignalPath: str):
  device = "cuda" if torch.cuda.is_available() else "cpu"
  hubert_ecg = AutoModel.from_pretrained("D:\Cairo University\Second Year\Second Semester\DSP\Tasks\Task 1\Biomedical-Signal-Viewer\CodeA\hubert-ecg-base", trust_remote_code=True)

  model = HuBERTECGClassifier(
    backbone    = hubert_ecg,
    hidden_size = hubert_ecg.config.hidden_size,num_classes = NUM_CLASSES).to(device)
  checkpoint = torch.load("ecg_hubert_final.pth", map_location="cpu", weights_only=False)
  model.load_state_dict(checkpoint["model_state_dict"])
  with torch.no_grad():
    model.eval()
    ecg  = preprocess_ecg(load_ecg(ecgSignalPath))
    x    = torch.FloatTensor(ecg).unsqueeze(0).to(device)
    prob = torch.sigmoid(model(x)).cpu().numpy()[0]
    detected, prob = CLASS_NAMES[np.argmax(prob)], float(np.max(prob))
    return detected, prob

def mat_to_json(path: str) -> dict:
    """
    Converts a .mat ECG file to a JSON-compatible dict with the structure:
    {
        "signals": [[sample0_lead0, sample0_lead1, ...], [sample1_lead0, ...], ...],
        "channels": ["I", "II", ...],
        "fs": 500
    }
    """
    ecg = load_ecg(path)

    # ecg shape can be (leads, samples) or (samples, leads) — normalize to (leads, samples)
    if ecg.ndim == 1:
        # Single lead — wrap in extra dimension
        ecg = ecg[np.newaxis, :]

    if ecg.shape[0] > ecg.shape[1]:
        # More rows than columns → likely (samples, leads), transpose it
        ecg = ecg.T

    num_leads = ecg.shape[0]

    # Match available leads to LEAD_NAMES, fall back to generic names if more leads than expected
    channels = LEAD_NAMES[:num_leads] if num_leads <= len(LEAD_NAMES) else [f"Lead_{i+1}" for i in range(num_leads)]

    # Transpose to (samples, leads) for the signals array
    # signals[i] = [lead0_val, lead1_val, ...] at sample i
    signals = ecg.T.tolist()

    return {
        "signals": signals,
        "channels": channels,
        "fs": 500  # Default ECG sampling frequency; override if known
    }

LEADS = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']

def preprocess_signal(signal, fs=SAMPLING_RATE):
    b, a = scipy.signal.butter(4, [0.5, 40], btype='bandpass', fs=fs)
    return scipy.signal.filtfilt(b, a, signal)

# ──────────────────────────────────────────────
# R-PEAK DETECTION
# ──────────────────────────────────────────────
def detect_r_peaks(signal, fs=SAMPLING_RATE):
    diff_sig   = np.diff(signal)
    squared    = diff_sig ** 2
    win        = int(0.15 * fs)
    integrated = np.convolve(squared, np.ones(win)/win, mode='same')
    peaks, _   = scipy.signal.find_peaks(integrated, distance=int(0.2 * fs), height=np.mean(integrated))
    return peaks

# ──────────────────────────────────────────────
# SIMPLE FEATURES PER LEAD
# ──────────────────────────────────────────────
def extract_features(signal, fs=SAMPLING_RATE):
    signal  = preprocess_signal(signal, fs)
    r_peaks = detect_r_peaks(signal, fs)
    feats   = {}

    # --- Statistical features ---
    feats["mean"]     = np.mean(signal)
    feats["std"]      = np.std(signal)
    feats["min"]      = np.min(signal)
    feats["max"]      = np.max(signal)
    feats["range"]    = np.max(signal) - np.min(signal)
    feats["skew"]     = skew(signal)
    feats["kurtosis"] = kurtosis(signal)
    feats["rms"]      = np.sqrt(np.mean(signal**2))

    # --- RR interval features (requires R-peaks) ---
    if len(r_peaks) >= 3:
        rr = np.diff(r_peaks) / fs * 1000  # in ms
        feats["rr_mean"]    = np.mean(rr)
        feats["rr_std"]     = np.std(rr)
        feats["rr_min"]     = np.min(rr)
        feats["rr_max"]     = np.max(rr)
        feats["rr_range"]   = np.max(rr) - np.min(rr)
        feats["heart_rate"] = 60000 / np.mean(rr)
        feats["rmssd"]      = np.sqrt(np.mean(np.diff(rr)**2))  # beat-to-beat variability
    else:
        for k in ["rr_mean","rr_std","rr_min","rr_max","rr_range","heart_rate","rmssd"]:
            feats[k] = np.nan

    return feats


def extract_features_12lead(signal_12, fs=SAMPLING_RATE):
    all_feats = {}
    for i, lead_name in enumerate(LEADS):
        feats = extract_features(signal_12[i, :], fs)
        for k, v in feats.items():
            all_feats[f"{lead_name}_{k}"] = v
    return all_feats


LABEL_NAMES = {0: "Normal", 1: "Arrhythmia (AF/AFL)"}

def PredictECGSignalMLBased(mat_path, model_dir="./"):
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(model_dir, "xgb_model.json"))
    feature_names = joblib.load(os.path.join(model_dir, "feature_names.joblib"))

    mat = scipy.io.loadmat(mat_path)
    signal_12 = mat['val'].astype(float)

    if signal_12.ndim != 2 or signal_12.shape[0] != 12:
        raise ValueError(f"Expected shape (12, n_samples), got {signal_12.shape}")

    feats = extract_features_12lead(signal_12)
    X     = pd.DataFrame([feats])[feature_names]

    # Replace NaNs with 0 — no imputer needed
    X = X.fillna(0)

    X_imp = X.values  # numpy array directly

    pred_class = model.predict(X_imp)[0]
    pred_proba = model.predict_proba(X_imp)[0]

    result = {
        "predicted_class":        int(pred_class),
        "predicted_label":        LABEL_NAMES[int(pred_class)],
        "probability_normal":     round(pred_proba[0], 4),
        "probability_arrhythmia": round(pred_proba[1], 4),
    }

    print(model.predict(X_imp))
    print(f"Prediction: {result['predicted_label']}")
    print(f"  Normal:      {result['probability_normal']:.2%}")
    print(f"  Arrhythmia:  {result['probability_arrhythmia']:.2%}")

    return LABEL_NAMES[int(pred_class)], float(round(pred_proba.max(), 4))