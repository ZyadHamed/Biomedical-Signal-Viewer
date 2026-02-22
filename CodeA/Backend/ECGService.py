import os, warnings, copy
import numpy as np
import pandas as pd
import scipy.io
import matplotlib.pyplot as plt
from tqdm import tqdm
warnings.filterwarnings('ignore')

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